# ClauseIQ Frontend

This directory contains the Next.js interface for ClauseIQ, the employment contract analyzer. It communicates with the FastAPI backend via REST endpoints.

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the example environment file and adjust values for your setup:

   ```bash
   cp .env.example .env.local
   ```

   Important variables:

   - `NEXT_PUBLIC_API_URL` – URL of the FastAPI backend. Defaults to `http://localhost:8000` for local development.
   - `NEXT_PUBLIC_MAX_FILE_SIZE_MB` – maximum allowed file upload size in megabytes.

3. Run the development server:

   ```bash
   npm run dev
   ```

   The app will be available at [http://localhost:3000](http://localhost:3000).

## Common Commands

- `npm run dev` – start the development server with hot reload.
- `npm run build` – create an optimized production build.
- `npm start` – run the production build locally.
- `npm test` – execute the Jest test suite.
- `npm run lint` – check code with ESLint.

## Usage

After starting both backend and frontend services, open the browser to upload an employment contract PDF. The frontend sends the file to the backend API defined in `NEXT_PUBLIC_API_URL` and displays the AI-generated summary and section breakdown.

## Project Structure

```
frontend/
├── src/
│   ├── app/                    # Next.js 13+ app router pages
│   │   ├── documents/          # Document management page
│   │   ├── debug/              # Debug and testing utilities
│   │   ├── login/              # Authentication pages
│   │   ├── register/
│   │   ├── forgot-password/
│   │   └── reset-password/
│   ├── components/             # Reusable React components
│   │   ├── DocumentCard.tsx    # Document display component
│   │   ├── NavBar.tsx          # Navigation component
│   │   └── ui/                 # UI components
│   ├── context/                # React context providers
│   │   ├── AuthContext.tsx     # Authentication state
│   │   └── AnalysisContext.tsx # Document analysis state
│   └── utils/                  # Utility functions
├── public/                     # Static assets
└── tests/                      # Jest test files
```

## Features

- 📄 **Document Upload**: Drag-and-drop PDF upload with validation
- 🔍 **AI Analysis**: Employment contract analysis using OpenAI GPT
- 🔐 **Authentication**: JWT-based user authentication with password reset
- 📱 **Responsive Design**: Mobile-friendly interface with Tailwind CSS
- 🗂️ **Document Management**: View, search, sort, and delete documents
- 🐛 **Debug Tools**: Built-in debugging and API testing utilities

## Technologies

- **Framework**: Next.js 15 with React 19
- **Styling**: Tailwind CSS
- **Language**: TypeScript
- **Authentication**: JWT tokens with refresh mechanism
- **Testing**: Jest with React Testing Library
- **Deployment**: Vercel (auto-deployment from main branch)

## Environment Variables

Create a `.env.local` file with:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_MAX_FILE_SIZE_MB=10
```

For production deployment, update `NEXT_PUBLIC_API_URL` to point to your deployed backend.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [ClauseIQ Project Documentation](../docs/) - comprehensive project documentation.
- [Backend API Documentation](../backend/README.md) - FastAPI backend details.
