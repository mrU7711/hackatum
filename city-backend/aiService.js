const { pipeline } = require('@xenova/transformers');

// Global variables for caching models
let zeroShotClassifier = null;

/**
 * Initialize the AI models
 */
async function initializeModels() {
  if (!zeroShotClassifier) {
    console.log("📥 Loading AI models (first time only, ~100MB)...");
    zeroShotClassifier = await pipeline('zero-shot-classification', 'Xenova/distilbert-base-uncased-mnli');
    console.log("✅ AI models loaded and ready!");
  }
}

/**
 * CATEGORY DEFINITIONS
 */
const CATEGORIES = {
  pothole: {
    name: 'pothole',
    keywords: ['pothole', 'pot hole', 'hole', 'crater', 'road damage', 'pavement damage',
      'road', 'street damage', 'asphalt', 'crack', 'bump'],
    aiLabel: 'pothole and road damage',
    defaultSeverity: 'high'
  },
  streetlight: {
    name: 'streetlight',
    keywords: ['street light', 'streetlight', 'light', 'lamp', 'lighting', 'dark',
      'illumination', 'bulb', 'pole light', 'blackout', 'flickering'],
    aiLabel: 'broken streetlight or lighting issue',
    defaultSeverity: 'medium'
  },
  litter: {
    name: 'litter',
    keywords: ['trash', 'litter', 'garbage', 'rubbish', 'waste', 'dump', 'dirty', 'mess', 'debris'],
    aiLabel: 'trash litter and garbage',
    defaultSeverity: 'low'
  },
  graffiti: {
    name: 'graffiti',
    keywords: ['graffiti', 'vandal', 'paint', 'tag', 'spray', 'defacement', 'drawing'],
    aiLabel: 'graffiti and vandalism',
    defaultSeverity: 'low'
  },
  safety: {
    name: 'safety',
    keywords: ['danger', 'dangerous', 'unsafe', 'hazard', 'risk', 'emergency', 'threat', 'accident'],
    aiLabel: 'safety hazard or danger',
    defaultSeverity: 'high'
  },
  infrastructure: {
    name: 'infrastructure',
    keywords: ['bridge', 'tunnel', 'sidewalk', 'curb', 'sign', 'bench', 'fence', 'drain', 'pipe', 'leak'],
    aiLabel: 'public infrastructure issue',
    defaultSeverity: 'medium'
  },
  social: {
    name: 'social',
    keywords: ['homeless', 'beggar', 'noise', 'disturbance', 'public drinking', 'loitering', 'camp'],
    aiLabel: 'social issue or public disturbance',
    defaultSeverity: 'medium'
  },
  other: {
    name: 'other',
    keywords: ['issue', 'problem', 'concern', 'repair', 'fix', 'broken', 'damage'],
    aiLabel: 'general urban issue',
    defaultSeverity: 'medium'
  },
  // HIDDEN CATEGORY FOR SPAM DETECTION
  irrelevant: {
    name: 'irrelevant',
    keywords: [],
    aiLabel: 'irrelevant text, personal statement, or gibberish',
    defaultSeverity: 'low'
  }
};

/**
 * SPAM DETECTION - Basic checks
 */
function detectSpam(description) {
  const lowerDesc = description.toLowerCase().trim();

  // 1. Too short
  if (description.length < 4) {
    return { isSpam: true, reason: 'Too short' };
  }

  // 2. Explicit spam/test keywords
  const spamKeywords = ['test', 'testing', 'asdf', 'qwerty', 'xyz', 'abc123', 'lmao'];
  for (const spam of spamKeywords) {
    if (lowerDesc === spam) {
      return { isSpam: true, reason: `Contains spam keyword: ${spam}` };
    }
  }

  return { isSpam: false };
}

/**
 * FUZZY KEYWORD MATCHING
 */
function matchesKeyword(text, keyword) {
  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();

  if (lowerText.includes(lowerKeyword)) return true;

  const textWords = lowerText.split(/\s+/);
  for (const word of textWords) {
    if (word.length < 3) continue;

    let matchScore = 0;
    const minLen = Math.min(word.length, lowerKeyword.length);

    if (Math.abs(word.length - lowerKeyword.length) > 2) continue;

    for (let i = 0; i < minLen; i++) {
      if (word[i] === lowerKeyword[i]) matchScore++;
    }

    if (matchScore / lowerKeyword.length >= 0.8) {
      return true;
    }
  }
  return false;
}

/**
 * KEYWORD-BASED CATEGORIZATION
 */
function keywordCategorize(description) {
  const results = [];

  for (const [catKey, catConfig] of Object.entries(CATEGORIES)) {
    if (catKey === 'irrelevant') continue; // Don't match keywords for irrelevant

    let matchCount = 0;
    const matchedKeywords = [];

    for (const keyword of catConfig.keywords) {
      if (matchesKeyword(description, keyword)) {
        matchCount++;
        matchedKeywords.push(keyword);
      }
    }

    if (matchCount > 0) {
      const confidence = Math.min(0.95, 0.6 + (matchCount * 0.15));
      results.push({
        category: catKey,
        confidence: confidence,
        matchCount: matchCount,
        matchedKeywords: matchedKeywords
      });
    }
  }

  results.sort((a, b) => {
    if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
    return b.confidence - a.confidence;
  });

  return results.length > 0 ? results[0] : null;
}

/**
 * CALCULATE FINAL SEVERITY
 */
function calculateSeverity(category, description, userSeverity, duplicateCount, aiConfidence) {
  const lowerDesc = description.toLowerCase();
  let baseSeverity = CATEGORIES[category]?.defaultSeverity || 'medium';

  const highKeywords = ['dangerous', 'urgent', 'emergency', 'large', 'huge', 'massive', 'severe', 'critical', 'major', 'damaging', 'blocked'];
  const lowKeywords = ['small', 'minor', 'little', 'cosmetic', 'aesthetic'];

  const hasHigh = highKeywords.some(kw => lowerDesc.includes(kw));
  const hasLow = lowKeywords.some(kw => lowerDesc.includes(kw));

  let severityScore = 5;

  if (baseSeverity === 'high') severityScore += 2;
  if (baseSeverity === 'low') severityScore -= 2;

  if (hasHigh) severityScore += 2;
  if (hasLow) severityScore -= 2;

  // USER INPUT WEIGHTING - DYNAMIC
  // If AI is unsure or category is 'other', trust user LESS
  const trustUser = category !== 'other' && aiConfidence > 0.4;

  if (userSeverity) {
    const weight = trustUser ? 3 : 1; // Reduce weight if untrusted
    if (userSeverity === 'high') severityScore += weight;
    if (userSeverity === 'low') severityScore -= weight;
  }

  if (duplicateCount >= 5) severityScore += 3;
  else if (duplicateCount >= 3) severityScore += 2;
  else if (duplicateCount >= 1) severityScore += 1;

  // CAP SEVERITY IF UNTRUSTED
  if (!trustUser && severityScore > 6) {
    severityScore = 6; // Cap at Medium-High, prevent High
  }

  let finalSeverity;
  if (severityScore >= 7) finalSeverity = 'high';
  else if (severityScore <= 3) finalSeverity = 'low';
  else finalSeverity = 'medium';

  return {
    severity: finalSeverity,
    score: severityScore,
    factors: {
      baseCategory: baseSeverity,
      hasUrgentKeywords: hasHigh,
      hasMinorKeywords: hasLow,
      userInput: userSeverity || 'none',
      duplicateCount: duplicateCount,
      trustUser: trustUser
    }
  };
}

/**
 * MAIN ANALYSIS FUNCTION
 */
async function analyzeReport(description, imageBuffer = null, userSeverity = null, duplicateCount = 0) {
  try {
    await initializeModels();

    // 1. BASIC SPAM CHECK
    const spamCheck = detectSpam(description);
    if (spamCheck.isSpam) {
      return {
        category: 'other',
        severity: 'low',
        isSpam: true,
        confidence: 0.95,
        reasoning: `Spam detected: ${spamCheck.reason}`,
        aiAnalysis: { isSpam: true }
      };
    }

    // 2. KEYWORD CATEGORIZATION
    const keywordResult = keywordCategorize(description);

    // 3. AI CLASSIFICATION (Zero-Shot)
    const aiLabels = Object.values(CATEGORIES).map(cat => cat.aiLabel);
    const aiResult = await zeroShotClassifier(description, aiLabels);

    let aiCategory = 'other';
    let aiConfidence = 0;

    for (const [catKey, catConfig] of Object.entries(CATEGORIES)) {
      const labelIndex = aiLabels.indexOf(catConfig.aiLabel);
      if (labelIndex === 0) {
        aiCategory = catKey;
        aiConfidence = aiResult.scores[0];
        break;
      }
    }

    // 4. CHECK FOR IRRELEVANT / GIBBERISH
    if (aiCategory === 'irrelevant') {
      return {
        category: 'other',
        severity: 'low',
        isSpam: true,
        confidence: aiConfidence,
        reasoning: `AI detected irrelevant content (${(aiConfidence * 100).toFixed(0)}%)`,
        aiAnalysis: { isSpam: true }
      };
    }

    // Gibberish check: If top confidence is very low
    if (aiConfidence < 0.15 && !keywordResult) {
      return {
        category: 'other',
        severity: 'low',
        isSpam: true,
        confidence: aiConfidence,
        reasoning: `AI detected gibberish (low confidence)`,
        aiAnalysis: { isSpam: true }
      };
    }

    // 5. COMBINE KEYWORD + AI
    let finalCategory;
    let finalConfidence;
    let method;

    if (keywordResult && keywordResult.confidence > 0.6) {
      finalCategory = keywordResult.category;
      finalConfidence = keywordResult.confidence;
      method = `keyword-based`;

      if (aiCategory === keywordResult.category) {
        finalConfidence = Math.min(0.99, finalConfidence + 0.1);
        method += ' + AI confirmed';
      }
    } else if (aiConfidence > 0.25) {
      finalCategory = aiCategory;
      finalConfidence = aiConfidence;
      method = 'AI classification';
    } else {
      finalCategory = 'other';
      finalConfidence = Math.max(keywordResult?.confidence || 0, aiConfidence);
      method = 'low confidence - marked as other';
    }

    // 6. CALCULATE SEVERITY (with Capping)
    const severityResult = calculateSeverity(
      finalCategory,
      description,
      userSeverity,
      duplicateCount,
      finalConfidence
    );

    const reasoning =
      `Category: ${finalCategory.toUpperCase()} (${(finalConfidence * 100).toFixed(0)}% confidence). ` +
      `Severity: ${severityResult.severity.toUpperCase()} (score: ${severityResult.score}/10). ` +
      `Method: ${method}. ` +
      (userSeverity ? `User rated as: ${userSeverity}. ` : '') +
      (duplicateCount > 0 ? `${duplicateCount} similar report(s) found. ` : '');

    return {
      category: finalCategory,
      severity: severityResult.severity,
      isSpam: false,
      confidence: finalConfidence,
      reasoning: reasoning,
      severityFactors: severityResult.factors,
      aiAnalysis: {
        category: finalCategory,
        severity: severityResult.severity,
        confidence: finalConfidence,
        severityFactors: severityResult.factors,
        isSpam: false
      }
    };

  } catch (error) {
    console.error("Error analyzing report:", error);
    return fallbackAnalysis(description, userSeverity);
  }
}

/**
 * FALLBACK ANALYSIS
 */
function fallbackAnalysis(description, userSeverity = null) {
  const spamCheck = detectSpam(description);
  if (spamCheck.isSpam) {
    return {
      category: 'other',
      severity: 'low',
      isSpam: true,
      confidence: 0.9,
      reasoning: 'Spam detected (fallback)',
      aiAnalysis: { isSpam: true }
    };
  }

  const keywordResult = keywordCategorize(description);

  if (keywordResult) {
    const severityResult = calculateSeverity(
      keywordResult.category,
      description,
      userSeverity,
      0,
      keywordResult.confidence
    );

    return {
      category: keywordResult.category,
      severity: severityResult.severity,
      isSpam: false,
      confidence: keywordResult.confidence,
      reasoning: 'Fallback keyword analysis',
      aiAnalysis: {
        category: keywordResult.category,
        severity: severityResult.severity,
        confidence: keywordResult.confidence,
        isSpam: false
      }
    };
  }

  return {
    category: 'other',
    severity: userSeverity || 'medium',
    isSpam: false,
    confidence: 0.3,
    reasoning: 'Fallback - could not categorize',
    aiAnalysis: {
      category: 'other',
      severity: userSeverity || 'medium',
      confidence: 0.3,
      isSpam: false
    }
  };
}

/**
 * FIND DUPLICATES
 */
async function findDuplicates(pool, lat, lon, category, currentReportId = null) {
  try {
    const latRange = 0.00045;
    const lonRange = 0.00045;

    const query = `
      SELECT 
        id,
        description,
        lat,
        lon,
        category,
        created_at,
        photo_url,
        severity
      FROM reports
      WHERE 
        lat BETWEEN ($1::float8 - $2::float8) AND ($1::float8 + $2::float8)
        AND lon BETWEEN ($3::float8 - $4::float8) AND ($3::float8 + $4::float8)
        AND category = $5
        AND created_at > NOW() - INTERVAL '7 days'
        ${currentReportId ? 'AND id != $6' : ''}
      LIMIT 10
    `;

    const params = currentReportId
      ? [lat, latRange, lon, lonRange, category, currentReportId]
      : [lat, latRange, lon, lonRange, category];

    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error("Error finding duplicates:", error);
    return [];
  }
}

/**
 * CALCULATE SIMILARITY
 */
function calculateSimilarity(desc1, desc2) {
  const words1 = desc1.toLowerCase().split(/\s+/);
  const words2 = desc2.toLowerCase().split(/\s+/);

  const set1 = new Set(words1);
  const set2 = new Set(words2);

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

module.exports = {
  analyzeReport,
  findDuplicates,
  calculateSimilarity,
};