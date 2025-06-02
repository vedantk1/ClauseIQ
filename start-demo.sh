#!/bin/bash

# Demo startup script for university presentation
echo "🎓 Starting Legal AI Demo for University Presentation..."

# Get your local IP address
LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -n1)

echo "📡 Your local IP address: $LOCAL_IP"
echo "🌐 Demo will be accessible at: http://$LOCAL_IP:3000"
echo ""

# Start backend with network access
echo "🔧 Starting backend server..."
cd backend
export HOST=0.0.0.0
export CORS_ORIGINS="http://localhost:3000,http://localhost:3001,http://$LOCAL_IP:3000"
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Wait for backend to start and verify it's running
echo "⏳ Waiting for backend to start..."
sleep 5

# Check if backend is running
if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "✅ Backend server is running on port 8000"
else
    echo "⚠️  Backend server may be starting (this is normal)"
fi

# Start frontend with network access
echo "🎨 Starting frontend server..."
cd ../frontend
export NEXT_PUBLIC_API_URL="http://$LOCAL_IP:8000"
npm run dev -- --hostname 0.0.0.0 &
FRONTEND_PID=$!

# Wait for frontend to start
echo "⏳ Waiting for frontend to start..."
sleep 8

echo ""
echo "🎉 Demo servers are ready!"
echo "🔗 Share this URL with your supervisor: http://$LOCAL_IP:3000"
echo ""
echo "📱 On the same WiFi network, your supervisor can access:"
echo "   - Frontend (Main App): http://$LOCAL_IP:3000"
echo "   - Backend API Docs: http://$LOCAL_IP:8000/docs"
echo ""
echo "📝 Demo Tips:"
echo "   - Use the sample contract file: sample-contract.md"
echo "   - Show the AI analysis features"
echo "   - Explain the technical architecture"
echo ""
echo "⏹️  To stop the demo, press Ctrl+C"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping demo servers..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    echo "✅ Demo stopped. Thank you for using Legal AI!"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Wait for user to stop
wait
