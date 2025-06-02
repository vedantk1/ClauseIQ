// Frontend configuration
interface Config {
  apiUrl: string;
  maxFileSizeMB: number;
}

const config: Config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  maxFileSizeMB: parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || "10"),
};

export default config;
