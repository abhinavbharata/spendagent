# SpendAgent

A personal spending analyzer that works from your bank notifications — no banking credentials needed. Powered by Claude AI.

## Files

```
spendagent/
├── index.html      — app structure
├── style.css       — styling
├── app.js          — logic, AI parsing, storage
├── manifest.json   — PWA manifest (add to home screen)
└── README.md       — this file
```

## Deploy to GitHub Pages (step by step)

### 1. Create a GitHub account
Go to [github.com](https://github.com) and sign up if you don't have an account.

### 2. Create a new repository
- Click the **+** icon → **New repository**
- Name it: `spendagent`
- Set it to **Public**
- Click **Create repository**

### 3. Upload the files
- On your new repo page, click **uploading an existing file**
- Drag and drop all 5 files: `index.html`, `style.css`, `app.js`, `manifest.json`, `README.md`
- Click **Commit changes**

### 4. Enable GitHub Pages
- Go to your repo → **Settings** → **Pages** (left sidebar)
- Under **Source**, select **Deploy from a branch**
- Set branch to **main**, folder to **/ (root)**
- Click **Save**

### 5. Access your app
After ~60 seconds, your app will be live at:
```
https://YOUR-USERNAME.github.io/spendagent
```

### 6. Add to iPhone home screen
- Open the URL in Safari on your iPhone
- Tap the **Share** icon → **Add to Home Screen**
- Tap **Add** — it appears as an app icon on your home screen

---

## First-time setup in the app

1. Open the app → go to **Settings** tab
2. Enter your Anthropic API key (get one free at [console.anthropic.com](https://console.anthropic.com))
3. Your key is saved only in your browser — never sent anywhere except the Anthropic API

## iOS Shortcut setup

See the **Setup** tab inside the app for step-by-step instructions to create an iOS Shortcut that automatically saves bank notifications to a file you can upload here weekly.

## How it works

- Paste bank SMS/push/email notifications → AI parses them into transactions
- Upload a `.txt` file from your iOS Shortcut for batch processing
- Dashboard shows spending by category and monthly trends
- AI Insights tab gives personalized analysis of your patterns
- All data stored in your browser (`localStorage`) — private and offline

## Privacy

- No server, no database, no accounts
- Your transactions stay in your browser only
- API calls go directly from your browser to Anthropic — nothing passes through any intermediate server
- You can clear all data anytime from the Add tab
