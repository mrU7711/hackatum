const express = require("express");
const cors = require("cors");
const multer = require("multer");
const pool = require("./db");
const supabase = require("./supabase");
const { analyzeReport, findDuplicates, calculateSimilarity } = require("./aiService");

const app = express();
app.use(cors());
app.use(express.json());

// Multer for temporary file uploads (memory storage)
const upload = multer({ storage: multer.memoryStorage() });

// --- GAMIFICATION ENDPOINTS ---

// POST: Sync user profile from Supabase Auth
app.post("/api/auth/sync", async (req, res) => {
  try {
    const { id, email, full_name } = req.body;

    // Upsert profile
    await pool.query(
      `INSERT INTO profiles (id, email, full_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE 
       SET email = EXCLUDED.email, full_name = EXCLUDED.full_name`,
      [id, email, full_name]
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Error syncing profile:", error);
    res.status(500).json({ error: "Failed to sync profile" });
  }
});

// GET: Leaderboard
app.get("/api/leaderboard", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, full_name, points 
      FROM profiles 
      ORDER BY points DESC 
      LIMIT 10
    `);

    res.json({ leaders: result.rows });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

// POST: Upvote a report
app.post("/api/upvote", async (req, res) => {
  try {
    const { reportId, userId } = req.body;

    // Check if already upvoted
    const check = await pool.query(
      "SELECT * FROM upvotes WHERE user_id = $1 AND report_id = $2",
      [userId, reportId]
    );

    if (check.rows.length > 0) {
      return res.status(400).json({ error: "Already upvoted" });
    }

    // Add upvote
    await pool.query(
      "INSERT INTO upvotes (user_id, report_id) VALUES ($1, $2)",
      [userId, reportId]
    );

    // Update report count
    await pool.query(
      "UPDATE reports SET upvote_count = upvote_count + 1 WHERE id = $1",
      [reportId]
    );

    // Award points to the ORIGINAL reporter
    const report = await pool.query("SELECT user_id FROM reports WHERE id = $1", [reportId]);
    if (report.rows[0] && report.rows[0].user_id) {
      await pool.query(
        "UPDATE profiles SET points = points + 5 WHERE id = $1",
        [report.rows[0].user_id]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error upvoting:", error);
    res.status(500).json({ error: "Failed to upvote" });
  }
});

// POST: Volunteer for a report
app.post("/api/volunteer", async (req, res) => {
  try {
    const { reportId, userId } = req.body;

    // Check if already volunteered
    const check = await pool.query(
      "SELECT * FROM volunteers WHERE user_id = $1 AND report_id = $2",
      [userId, reportId]
    );

    if (check.rows.length > 0) {
      return res.status(400).json({ error: "Already volunteered" });
    }

    // Check if volunteering is enabled
    const report = await pool.query(
      "SELECT volunteer_enabled FROM reports WHERE id = $1",
      [reportId]
    );

    if (!report.rows[0] || !report.rows[0].volunteer_enabled) {
      return res.status(400).json({ error: "Volunteering not enabled for this report" });
    }

    // Add volunteer
    await pool.query(
      "INSERT INTO volunteers (user_id, report_id) VALUES ($1, $2)",
      [userId, reportId]
    );

    // Award 15 points
    await pool.query(
      "UPDATE profiles SET points = points + 15 WHERE id = $1",
      [userId]
    );

    res.json({
      success: true,
      message: "Thank you for volunteering! You earned 15 points.",
      pointsEarned: 15
    });
  } catch (error) {
    console.error("Error volunteering:", error);
    res.status(500).json({ error: "Failed to volunteer" });
  }
});

// PATCH: Toggle volunteer option (Admin only)
app.patch("/api/reports/:id/volunteer-toggle", async (req, res) => {
  try {
    const { id } = req.params;
    const { volunteer_enabled } = req.body;

    await pool.query(
      "UPDATE reports SET volunteer_enabled = $1 WHERE id = $2",
      [volunteer_enabled, id]
    );

    res.json({ success: true, volunteer_enabled });
  } catch (error) {
    console.error("Error toggling volunteer:", error);
    res.status(500).json({ error: "Failed to toggle volunteer option" });
  }
});

// GET: Get volunteers for a report
app.get("/api/reports/:id/volunteers", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT v.*, p.email, p.full_name, v.created_at as volunteered_at
      FROM volunteers v
      JOIN profiles p ON v.user_id = p.id
      WHERE v.report_id = $1
      ORDER BY v.created_at DESC
    `, [id]);

    res.json({ volunteers: result.rows });
  } catch (error) {
    console.error("Error fetching volunteers:", error);
    res.status(500).json({ error: "Failed to fetch volunteers" });
  }
});

// GET: Admin stats
app.get("/api/stats", async (req, res) => {
  try {
    const totalReports = await pool.query("SELECT COUNT(*) FROM reports");
    const pendingReports = await pool.query("SELECT COUNT(*) FROM reports WHERE status = 'pending'");
    const resolvedReports = await pool.query("SELECT COUNT(*) FROM reports WHERE status = 'resolved'");
    const spamReports = await pool.query("SELECT COUNT(*) FROM reports WHERE is_spam = TRUE");

    res.json({
      totalReports: parseInt(totalReports.rows[0].count),
      pendingReports: parseInt(pendingReports.rows[0].count),
      resolvedReports: parseInt(resolvedReports.rows[0].count),
      spamReports: parseInt(spamReports.rows[0].count),
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// --- REPORT ENDPOINTS ---

// POST: Submit a new report with AI analysis
app.post("/api/report", upload.single("photo"), async (req, res) => {
  try {
    const { description, lat, lon, userSeverity, userId } = req.body;
    let photo_url = null;

    // Upload photo to Supabase Storage
    if (req.file) {
      const fileName = `${Date.now()}-${req.file.originalname}`;

      const { data, error } = await supabase.storage
        .from("report-photos")
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false,
        });

      if (error) {
        console.error("Supabase upload error:", error);
        return res.status(500).json({ error: "Failed to upload image" });
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("report-photos")
        .getPublicUrl(fileName);

      photo_url = urlData.publicUrl;
    }

    // FIRST: Do a preliminary categorization to check for duplicates
    console.log("🤖 Preliminary AI analysis for duplicate check...");
    const preliminaryAnalysis = await analyzeReport(description, req.file ? req.file.buffer : null);

    // Find potential duplicates with preliminary category
    console.log("🔍 Checking for duplicates...");
    const duplicates = await findDuplicates(
      pool,
      parseFloat(lat),
      parseFloat(lon),
      preliminaryAnalysis.category,
      null
    );

    const duplicateCount = duplicates.length;
    console.log(`✅ Found ${duplicateCount} potential duplicate(s)`);

    // SECOND: Final AI analysis with duplicate count and user severity
    console.log("🤖 Final AI analysis with all factors...");
    const aiAnalysis = await analyzeReport(
      description,
      req.file ? req.file.buffer : null,
      userSeverity,
      duplicateCount
    );
    console.log("✅ AI Analysis complete:", aiAnalysis);

    // CONFIDENCE THRESHOLD: If confidence is below 20%, mark as spam
    if (aiAnalysis.confidence < 0.2) {
      console.log(`⚠️ Low confidence (${aiAnalysis.confidence}) - marking as spam`);
      aiAnalysis.isSpam = true;
      aiAnalysis.category = 'other';
    }

    // Insert report into database with AI results
    const result = await pool.query(
      `INSERT INTO reports 
       (description, photo_url, lat, lon, category, severity, is_spam, ai_confidence, analyzed_at, user_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9) 
       RETURNING *`,
      [
        description,
        photo_url,
        parseFloat(lat),
        parseFloat(lon),
        aiAnalysis.category,
        aiAnalysis.severity,
        aiAnalysis.isSpam,
        aiAnalysis.confidence,
        userId || null
      ]
    );

    const newReport = result.rows[0];

    // Award Points (+10 for submission)
    if (userId && !aiAnalysis.isSpam) {
      await pool.query(
        "UPDATE profiles SET points = points + 10 WHERE id = $1",
        [userId]
      );
    }

    // Save duplicate relationships (only if not spam)
    if (!aiAnalysis.isSpam && duplicates.length > 0) {
      for (const dup of duplicates) {
        const similarity = calculateSimilarity(description, dup.description);

        if (similarity > 0.3) {
          await pool.query(
            `INSERT INTO report_duplicates (primary_report_id, duplicate_report_id, similarity_score)
             VALUES ($1, $2, $3)
             ON CONFLICT (primary_report_id, duplicate_report_id) DO NOTHING`,
            [dup.id, newReport.id, similarity]
          );
        }
      }
    }

    res.json({
      message: aiAnalysis.isSpam
        ? "Report flagged as spam"
        : "Report submitted successfully! (+10 points)",
      report: newReport,
      aiAnalysis: {
        category: aiAnalysis.category,
        severity: aiAnalysis.severity,
        isSpam: aiAnalysis.isSpam,
        confidence: aiAnalysis.confidence,
        reasoning: aiAnalysis.reasoning,
        severityFactors: aiAnalysis.severityFactors,
      },
      duplicates: duplicates.length > 0 ? {
        count: duplicates.length,
        message: `${duplicates.length} similar report(s) found in this area`,
        reports: duplicates.map(d => ({
          id: d.id,
          description: d.description,
          severity: d.severity,
          created_at: d.created_at
        }))
      } : null,
    });
  } catch (error) {
    console.error("Error submitting report:", error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// GET: Fetch all reports with AI analysis data
app.get("/api/reports", async (req, res) => {
  try {
    const { category, severity, excludeSpam, userId } = req.query;

    let query = "SELECT r.* FROM reports r";
    const params = [];
    let paramCount = 1;

    // If userId is provided, we need to check upvotes and volunteers
    if (userId) {
      console.log(`Fetching reports for user: ${userId}`);
      query = `
        SELECT r.*, 
        CASE WHEN u.user_id IS NOT NULL THEN TRUE ELSE FALSE END as has_upvoted,
        CASE WHEN v.user_id IS NOT NULL THEN TRUE ELSE FALSE END as has_volunteered
        FROM reports r
        LEFT JOIN upvotes u ON r.id = u.report_id AND u.user_id::text = $${paramCount}
        LEFT JOIN volunteers v ON r.id = v.report_id AND v.user_id::text = $${paramCount}
      `;
      params.push(userId);
      paramCount++;
    } else {
      query = "SELECT r.*, FALSE as has_upvoted, FALSE as has_volunteered FROM reports r";
    }

    query += " WHERE 1=1";

    // Filter by category
    if (category) {
      query += ` AND r.category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }

    // Filter by severity
    if (severity) {
      query += ` AND r.severity = $${paramCount}`;
      params.push(severity);
      paramCount++;
    }

    // Exclude spam
    if (excludeSpam === "true") {
      query += ` AND r.is_spam = FALSE`;
    }

    query += " ORDER BY r.upvote_count DESC, r.created_at DESC";

    const result = await pool.query(query, params);

    res.json({
      reports: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error("Error fetching reports:", error);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

// GET: Fetch single report by ID with duplicates
app.get("/api/reports/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Get report
    const reportResult = await pool.query(
      "SELECT * FROM reports WHERE id = $1",
      [id]
    );

    if (reportResult.rows.length === 0) {
      return res.status(404).json({ error: "Report not found" });
    }

    const report = reportResult.rows[0];

    // Get duplicates
    const duplicatesResult = await pool.query(
      `SELECT r.*, rd.similarity_score
       FROM reports r
       JOIN report_duplicates rd ON (r.id = rd.duplicate_report_id OR r.id = rd.primary_report_id)
       WHERE (rd.primary_report_id = $1 OR rd.duplicate_report_id = $1) AND r.id != $1
       ORDER BY rd.similarity_score DESC`,
      [id]
    );

    res.json({
      report,
      duplicates: duplicatesResult.rows,
    });
  } catch (error) {
    console.error("Error fetching report:", error);
    res.status(500).json({ error: "Failed to fetch report" });
  }
});

// PATCH: Update report status (admin only)
app.patch("/api/reports/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    await pool.query(
      "UPDATE reports SET status = $1, resolved_at = CASE WHEN $1 = 'resolved' THEN NOW() ELSE NULL END WHERE id = $2",
      [status, id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Error updating status:", error);
    res.status(500).json({ error: "Failed to update status" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});

// Initialize database schema on startup
(async () => {
  try {
    console.log('🔧 Checking database schema...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS profiles (
        id UUID PRIMARY KEY,
        email TEXT,
        full_name TEXT,
        points INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Check reports.id type to avoid FK errors
    const reportsIdTypeRes = await pool.query(`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'reports' AND column_name = 'id';
    `);
    const reportsIdType = reportsIdTypeRes.rows[0]?.data_type || 'integer';
    console.log(`📊 Reports ID type is: ${reportsIdType}`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS upvotes (
        id SERIAL PRIMARY KEY,
        user_id UUID REFERENCES profiles(id),
        report_id ${reportsIdType} REFERENCES reports(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, report_id)
      );
    `);

    await pool.query(`
      ALTER TABLE reports 
      ADD COLUMN IF NOT EXISTS upvote_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS user_id UUID,
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
    `);

    console.log('✅ Database schema ready');
  } catch (e) {
    console.error('❌ Schema update failed:', e.message);
  }
})();
