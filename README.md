# Legal AI - Employment Contract Analyzer

An intelligent legal document analysis tool that uses AI to help non-lawyers understand employment contracts by providing clear, plain-language summaries of complex legal text.

![Legal AI Demo](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)
![Python](https://img.shields.io/badge/Python-3.13-blue)
![Next.js](https://img.shields.io/badge/Next.js-15.3.3-black)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115.12-009688)

## 🚀 Features

- **AI-Powered Summaries**: Uses OpenAI GPT-3.5-turbo to generate clear, concise summaries
- **PDF Text Extraction**: Robust PDF processing with `pdfplumber`
- **Section Analysis**: Intelligent document segmentation and section-by-section analysis
- **Document Storage**: MongoDB integration for document history and retrieval
- **Modern UI**: Clean, responsive Next.js interface with Tailwind CSS
- **Security**: File validation, secure temporary file handling, and input sanitization
- **Real-time Processing**: Asynchronous processing with progress feedback

## 🏗️ Architecture

### Backend (FastAPI)

- **PDF Processing**: Text extraction and document analysis
- **AI Integration**: OpenAI API for intelligent summarization
- **Database**: MongoDB for document storage and retrieval
- **API Endpoints**: RESTful API with comprehensive validation

### Frontend (Next.js)

- **Modern React**: Next.js 15 with React 19 and TypeScript
- **Responsive Design**: Tailwind CSS with dark mode support
- **State Management**: Context API for global state
- **User Experience**: Toast notifications and loading states

## 📋 Prerequisites

- **Python 3.13+**
- **Node.js 18+** and npm
- **OpenAI API Key** (for AI summaries)
- **MongoDB** (Atlas or local instance)

## 🛠️ Installation & Setup

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd legal-ai-project
```

### 2. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate  # On macOS/Linux
# or
venv\Scripts\activate     # On Windows

# Install dependencies
pip install -r requirements.txt

# Environment Configuration
cp .env.example .env
```

Edit `.env` file with your configuration:

```env
OPENAI_API_KEY=sk-your-actual-openai-api-key-here
MONGODB_URI=your-mongodb-connection-string
MAX_FILE_SIZE_MB=10
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Environment Configuration
cp .env.example .env.local
```

Edit `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_MAX_FILE_SIZE_MB=10
```

### 4. Start Services

**Backend:**

```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload
```

Backend will be available at: http://localhost:8000

**Frontend:**

```bash
cd frontend
npm run dev
```

Frontend will be available at: http://localhost:3000

## 🔧 API Endpoints

| Endpoint             | Method | Description                                  |
| -------------------- | ------ | -------------------------------------------- |
| `/`                  | GET    | Health check                                 |
| `/extract-text/`     | POST   | Extract raw text from PDF                    |
| `/analyze/`          | POST   | Full analysis with section breakdown         |
| `/process-document/` | POST   | Complete document processing with AI summary |
| `/documents/`        | GET    | List all processed documents                 |
| `/documents/{id}`    | GET    | Get specific document                        |

## 🧪 Testing

### Backend Tests

```bash
cd backend
source venv/bin/activate
pytest
```

### Frontend Tests

```bash
cd frontend
npm test
```

## 🐳 Docker Support

### Development

```bash
docker-compose -f docker-compose.dev.yml up
```

### Production

```bash
docker-compose up
```

## 🛡️ Security Features

- **File Validation**: Size limits, type checking, filename sanitization
- **Secure File Handling**: Temporary files with automatic cleanup
- **Input Sanitization**: Comprehensive validation of all inputs
- **Environment Security**: Sensitive credentials in environment variables
- **CORS Configuration**: Configurable cross-origin resource sharing

## 📱 Usage

1. **Upload Document**: Select a PDF employment contract
2. **AI Analysis**: Get intelligent summaries and section breakdowns
3. **Review Results**: View plain-language explanations of legal terms
4. **Document History**: Access previously analyzed documents

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## ⚠️ Legal Disclaimer

This tool is provided for informational purposes only and does not constitute legal advice. Always consult with a qualified legal professional before making decisions based on contract analysis.

## 🙏 Acknowledgments

- OpenAI for providing the GPT API
- FastAPI and Next.js communities
- Contributors and testers

---

**Made with ❤️ for better legal document understanding**
