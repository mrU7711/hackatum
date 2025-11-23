# Munich City - Citizen Report System

A comprehensive mobile application for citizens to report city issues, with AI-powered analysis, gamification, and volunteer coordination features.

---

## 📱 Overview

**Munich City** is a React Native mobile application that empowers citizens to report infrastructure problems, safety concerns, and other city issues. The system uses AI to analyze reports, detect duplicates, assign severity levels, and filter spam, while gamifying civic engagement through a points-based reward system.

---

## ✨ Key Features

### 🎯 Core Functionality

#### 1. **Report Submission**
- **Photo Upload**: Capture or select photos of issues
- **Location Tracking**: Automatic GPS coordinates capture
- **Category Selection**: Infrastructure, Safety, Environment, Social, etc.
- **User Severity Input**: Citizens can suggest severity level
- **AI Analysis**: Automatic categorization, severity assessment, and spam detection
- **Duplicate Detection**: AI identifies similar reports in the area

#### 2. **AI-Powered Intelligence**
- **Gemini AI Integration**: Uses Google's Gemini 1.5 Flash for analysis
- **Smart Categorization**: Automatically assigns correct category
- **Severity Assessment**: Evaluates urgency (Low/Medium/High)
- **Spam Filtering**: Detects and flags inappropriate submissions
- **Duplicate Finding**: Identifies similar reports within 500m radius
- **Similarity Scoring**: Calculates text similarity between reports

#### 3. **Gamification System**
- **Points Rewards**:
  - +10 points for submitting a valid report
  - +5 points when your report gets upvoted
  - +15 points for volunteering to help
- **Leaderboard**: Top 10 contributors ranked by points
- **User Profiles**: Track personal contributions and points

#### 4. **Community Engagement**
- **Upvoting**: Support important reports (one vote per user)
- **Volunteering**: Offer to help resolve issues (earn 15 points)
- **My Reports**: View your submission history
- **Status Tracking**: Monitor report progress (Pending/In Progress/Resolved)

#### 5. **Interactive Map**
- **Clustered Markers**: Reports grouped by location
- **Color-Coded Severity**: Visual severity indicators
- - **Filter by Category**: View specific issue types
- **Real-time Updates**: Live report locations

#### 6. **Admin Dashboard**
- **Analytics**: Total, pending, resolved, and spam statistics
- **Report Management**: Update status, review details
- **Filtering**: Category and severity filters
- **Volunteer Control**: Enable/disable volunteering per report
- **Photo Review**: View submitted images
- **Status Updates**: Change report status (Pending/In Progress/Resolved)

---

## 🏗️ Technology Stack

### **Frontend (Mobile App)**
- **Framework**: React Native with Expo
- **Language**: TypeScript
- **Navigation**: Expo Router (file-based routing)
- **UI Components**:
  - React Native core components
  - Expo Vector Icons
  - Expo Blur (glassmorphism effects)
  - React Native Maps (clustering)
- **State Management**: React Context API
- **Location Services**: Expo Location
- **Image Handling**: Expo Image Picker
- **Authentication**: Supabase Auth

### **Backend (API Server)**
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL (Supabase)
- **Storage**: Supabase Storage (report photos)
- **AI Service**: Google Gemini 1.5 Flash
- **File Upload**: Multer (memory storage)
- **CORS**: Enabled for cross-origin requests

### **Database Schema**

#### Tables:
1. **`profiles`**
   - `id` (UUID, PK) - User ID from Supabase Auth
   - `email` (TEXT)
   - `full_name` (TEXT)
   - `points` (INTEGER, default: 0)
   - `created_at` (TIMESTAMPTZ)

2. **`reports`**
   - `id` (UUID/INTEGER, PK)
   - `description` (TEXT)
   - `photo_url` (TEXT)
   - `lat` (FLOAT)
   - `lon` (FLOAT)
   - `category` (TEXT) - AI-assigned
   - `severity` (TEXT) - AI-assigned (low/medium/high)
   - `is_spam` (BOOLEAN) - AI-detected
   - `ai_confidence` (FLOAT)
   - `status` (TEXT) - pending/in_progress/resolved
   - `upvote_count` (INTEGER, default: 0)
   - `user_id` (UUID, FK to profiles)
   - `volunteer_enabled` (BOOLEAN, default: FALSE)
   - `analyzed_at` (TIMESTAMPTZ)
   - `resolved_at` (TIMESTAMPTZ)
   - `created_at` (TIMESTAMPTZ)

3. **`upvotes`**
   - `id` (SERIAL, PK)
   - `user_id` (UUID, FK to profiles)
   - `report_id` (UUID/INTEGER, FK to reports)
   - `created_at` (TIMESTAMPTZ)
   - UNIQUE constraint: (user_id, report_id)

4. **`volunteers`**
   - `id` (SERIAL, PK)
   - `user_id` (UUID, FK to profiles)
   - `report_id` (UUID/INTEGER, FK to reports)
   - `created_at` (TIMESTAMPTZ)
   - UNIQUE constraint: (user_id, report_id)

5. **`report_duplicates`**
   - `id` (SERIAL, PK)
   - `primary_report_id` (UUID/INTEGER, FK to reports)
   - `duplicate_report_id` (UUID/INTEGER, FK to reports)
   - `similarity_score` (FLOAT)
   - `created_at` (TIMESTAMPTZ)

---

## 🔄 Data Flow & Workflows

### **1. Report Submission Flow**

```
User fills form → Captures photo → Submits
    ↓
Backend receives data
    ↓
Upload photo to Supabase Storage
    ↓
Preliminary AI analysis (category only)
    ↓
Find potential duplicates (500m radius, same category)
    ↓
Final AI analysis (with duplicate count & user severity)
    ↓
Insert report into database
    ↓
Award +10 points to user (if not spam)
    ↓
Save duplicate relationships (similarity > 0.3)
    ↓
Return report + AI analysis + duplicates to user
```

### **2. AI Analysis Workflow**

```
Input: Description, Photo (optional), User Severity, Duplicate Count
    ↓
Send to Gemini AI with structured prompt
    ↓
AI Returns:
  - category (infrastructure/safety/environment/social/other)
  - severity (low/medium/high)
  - isSpam (true/false)
  - confidence (0.0-1.0)
  - reasoning (explanation)
  - severityFactors (list of contributing factors)
    ↓
Store in database with analyzed_at timestamp
```

### **3. Upvote Workflow**

```
User clicks upvote button
    ↓
Check if already upvoted (upvotes table)
    ↓
If not: Insert upvote record
    ↓
Increment report.upvote_count
    ↓
Award +5 points to ORIGINAL reporter
    ↓
Update UI optimistically
```

### **4. Volunteer Workflow**

```
Admin enables volunteering for report
    ↓
User sees "Volunteer to Help" button
    ↓
User clicks volunteer
    ↓
Check if already volunteered
    ↓
Check if volunteering is enabled
    ↓
Insert volunteer record
    ↓
Award +15 points to volunteer
    ↓
Update UI with "VOLUNTEERED" state
```

### **5. Admin Status Update Flow**

```
Admin opens report detail
    ↓
Selects new status (pending/in_progress/resolved)
    ↓
PATCH /api/reports/:id/status
    ↓
Update report.status
    ↓
If resolved: Set resolved_at timestamp
    ↓
Refresh stats
    ↓
Update UI
```

---

## 🌐 API Endpoints

### **Authentication**
- `POST /api/auth/sync` - Sync user profile from Supabase Auth

### **Reports**
- `POST /api/report` - Submit new report (with photo upload)
- `GET /api/reports` - Fetch all reports (with filters & user-specific data)
- `GET /api/reports/:id` - Fetch single report with duplicates
- `PATCH /api/reports/:id/status` - Update report status (admin)
- `PATCH /api/reports/:id/volunteer-toggle` - Enable/disable volunteering (admin)

### **Gamification**
- `GET /api/leaderboard` - Top 10 users by points
- `POST /api/upvote` - Upvote a report
- `POST /api/volunteer` - Volunteer for a report
- `GET /api/reports/:id/volunteers` - Get volunteers for a report

### **Admin**
- `GET /api/stats` - Dashboard statistics (total, pending, resolved, spam)

---

## 🎨 Design System

### **Color Palette (Blue Theme)**
- **Primary**: `#1b98d5` (Bright Blue)
- **Secondary**: `#005a9f` (Deep Blue)
- **Accent**: `#3a5368` (Slate Blue)
- **Success**: `#00C853` (Green)
- **Warning**: `#FFD600` (Yellow)
- **Error**: `#FF3D00` (Red)
- **Background**: `#0a0a0f` (Dark)
- **Surface**: `#15151a` (Slightly lighter dark)
- **Text**: `#FFFFFF` (White)
- **Text Secondary**: `rgba(255, 255, 255, 0.8)`

### **UI Patterns**
- **Glassmorphism**: Semi-transparent backgrounds with blur
- **Card-based Layout**: Elevated cards with shadows
- **Status Badges**: Color-coded severity and status indicators
- **Floating Action Buttons**: Primary actions prominently displayed
- **Bottom Navigation**: 3 tabs (Reports, Map, Community)

---

## 📂 Project Structure

```
hackatum/
├── city-app/                    # React Native mobile app
│   ├── app/
│   │   ├── (tabs)/             # Tab navigation screens
│   │   │   ├── index.tsx       # Reports screen (home)
│   │   │   ├── map.tsx         # Map view
│   │   │   ├── community.tsx   # Leaderboard & my reports
│   │   │   └── _layout.tsx     # Tab navigation config
│   │   ├── _layout.tsx         # Root layout
│   │   └── +not-found.tsx      # 404 screen
│   ├── components/
│   │   ├── AdminDashboard.tsx  # Admin panel
│   │   ├── ReportDetailModal.tsx # Report details popup
│   │   ├── SubmitReportModal.tsx # Report submission form
│   │   └── ...
│   ├── context/
│   │   ├── AuthContext.tsx     # Authentication state
│   │   └── AdminContext.tsx    # Admin state
│   ├── constants/
│   │   └── theme.ts            # Design system tokens
│   └── package.json
│
├── city-backend/               # Node.js API server
│   ├── index.js               # Main server file
│   ├── db.js                  # PostgreSQL connection
│   ├── supabase.js            # Supabase client
│   ├── aiService.js           # Gemini AI integration
│   └── package.json
│
└── README.md                  # This file
```

---

## 🚀 Setup & Installation

### **Prerequisites**
- Node.js 18+ and npm
- Expo CLI (`npm install -g expo-cli`)
- PostgreSQL database (Supabase account)
- Google Gemini API key
- Supabase project with Storage bucket

### **Backend Setup**

1. **Navigate to backend directory**:
   ```bash
   cd city-backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment** (create `.env` or update `db.js`, `supabase.js`, `aiService.js`):
   - PostgreSQL connection string
   - Supabase URL and anon key
   - Supabase service role key
   - Google Gemini API key

4. **Start server**:
   ```bash
   node index.js
   ```
   Server runs on `http://0.0.0.0:5000`

### **Frontend Setup**

1. **Navigate to app directory**:
   ```bash
   cd city-app
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Update API URL** in relevant files:
   - `app/(tabs)/index.tsx`
   - `app/(tabs)/community.tsx`
   - `components/AdminDashboard.tsx`
   
   Change `API_URL` to your backend server address.

4. **Configure Supabase** in `context/AuthContext.tsx`:
   - Update Supabase URL and anon key

5. **Start Expo**:
   ```bash
   npx expo start
   ```

6. **Run on device**:
   - Scan QR code with Expo Go app (iOS/Android)
   - Or press `i` for iOS simulator, `a` for Android emulator

---

## 👥 User Roles

### **Regular User**
- Submit reports
- Upvote reports
- Volunteer for reports
- View map and community
- Track personal points and reports

### **Administrator**
- All regular user features
- Access admin dashboard
- View analytics
- Update report status
- Enable/disable volunteering
- Filter and manage all reports

**Admin Access**: Hardcoded password in `context/AdminContext.tsx`

---

## 🔐 Security Features

- **Supabase Authentication**: Secure user login/signup
- **Row-Level Security**: Database-level access control
- **Spam Detection**: AI-powered spam filtering
- **Duplicate Prevention**: One upvote/volunteer per user per report
- **Photo Storage**: Secure Supabase Storage with public URLs
- **CORS Protection**: Configured for specific origins

---

## 📊 Analytics & Metrics

### **Tracked Metrics**
- Total reports submitted
- Pending reports count
- Resolved reports count
- Spam reports detected
- User engagement (upvotes, volunteers)
- Top contributors (leaderboard)

### **AI Performance**
- Confidence scores for each analysis
- Category accuracy
- Severity assessment
- Spam detection rate
- Duplicate finding effectiveness

---

## 🎮 Gamification Mechanics

### **Point System**
| Action | Points Awarded | Recipient |
|--------|---------------|-----------|
| Submit valid report | +10 | Reporter |
| Report gets upvoted | +5 | Original reporter |
| Volunteer to help | +15 | Volunteer |

### **Leaderboard**
- Top 10 users displayed
- Sorted by total points
- Real-time updates
- Encourages civic participation

---

## 🗺️ Map Features

- **Clustering**: Groups nearby reports for better visualization
- **Color Coding**: 
  - 🔴 High severity
  - 🟡 Medium severity
  - 🟢 Low severity
- **Category Filtering**: View specific issue types
- **Interactive Markers**: Tap to view report details
- **User Location**: Shows current position

---

## 🐛 Known Limitations

- Admin password is hardcoded (should use proper auth)
- No email notifications for volunteers
- Map requires location permissions
- AI analysis requires internet connection
- Photo upload limited by Supabase storage quota

---

## 🔮 Future Enhancements

- [ ] Push notifications for report updates
- [ ] Multi-language support
- [ ] Dark/Light theme toggle
- [ ] Report comments/discussion
- [ ] Admin user management
- [ ] Export reports to CSV
- [ ] Advanced analytics dashboard
- [ ] Integration with city systems
- [ ] Offline mode support
- [ ] Report sharing to social media

---

## 📄 License

This project was created for HackaTUM 2025.

---

## 👨‍💻 Development

### **Key Dependencies**

**Frontend**:
- `expo` - Development platform
- `react-native` - Mobile framework
- `expo-router` - File-based navigation
- `react-native-maps` - Map integration
- `@supabase/supabase-js` - Backend client

**Backend**:
- `express` - Web framework
- `pg` - PostgreSQL client
- `@supabase/supabase-js` - Storage & auth
- `@google/generative-ai` - Gemini AI
- `multer` - File upload handling
- `cors` - Cross-origin requests

### **Development Commands**

```bash
# Frontend
npm start              # Start Expo dev server
npm run android        # Run on Android
npm run ios            # Run on iOS

# Backend
node index.js          # Start API server
```

---

## 🆘 Support

For issues or questions:
1. Check the code comments
2. Review API endpoint documentation
3. Verify environment configuration
4. Check database schema matches expected structure

---

**Built with ❤️ for Munich City**
