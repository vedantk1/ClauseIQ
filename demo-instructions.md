# University Demo Instructions

## Quick Demo Setup

### Option 1: Local Network Demo (Recommended)

```bash
cd /Users/vedan/Downloads/legal-ai-project
chmod +x start-demo.sh
./start-demo.sh
```

- Share the displayed URL with your supervisor
- Both need to be on same WiFi network

### Option 2: Public Tunnel (Backup)

```bash
# Terminal 1
./start-demo.sh

# Terminal 2
ngrok http 3000
```

- Share the ngrok URL (works from anywhere)

### Option 3: Docker Demo (Professional)

```bash
docker-compose up --build
```

- Access at http://your-ip:3000

## Demo Script

1. **Introduction** (2 min)

   - "This is an AI-powered legal document analyzer"
   - "Built with FastAPI backend and Next.js frontend"

2. **Upload Demo** (3 min)

   - Upload a sample employment contract PDF
   - Show real-time processing

3. **Results Review** (5 min)

   - Explain AI-generated summaries
   - Show section-by-section analysis
   - Highlight key terms identification

4. **Technical Architecture** (5 min)

   - Show MongoDB integration
   - Explain OpenAI API usage
   - Discuss security features

5. **Q&A** (5 min)

## Sample Test Files

- Use any PDF employment contract
- Or create a simple test PDF with contract-like text

## Troubleshooting

- If WiFi issues: Use ngrok tunnel
- If demo fails: Have screenshots ready
- If questions about code: Show the GitHub repository structure
