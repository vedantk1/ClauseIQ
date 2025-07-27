#!/bin/bash

# ClauseIQ Development Environment Setup Script
# Level 3 Full Automation - Handles all prerequisites and dependencies
# Supports: macOS, Ubuntu/Debian, RHEL/CentOS, Windows WSL

set -e  # Exit on any error

# ============================================================================
# CONFIGURATION & CONSTANTS
# ============================================================================

SCRIPT_VERSION="2.1.0"
PROJECT_NAME="ClauseIQ"
REQUIRED_PYTHON_VERSION="3.11"
REQUIRED_NODE_VERSION="18"
MONGODB_VERSION="7.0"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

print_header() {
    echo -e "${PURPLE}"
    echo "🚀 $PROJECT_NAME Development Setup v$SCRIPT_VERSION"
    echo "=================================================="
    echo -e "${NC}"
}

print_section() {
    echo -e "\n${CYAN}📋 $1${NC}"
    echo "----------------------------------------"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_step() {
    echo -e "${PURPLE}🔄 $1${NC}"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Compare version numbers
version_compare() {
    printf '%s\n%s\n' "$2" "$1" | sort -V -C
}

# Get current directory name
get_project_dir() {
    basename "$(pwd)"
}

# ============================================================================
# SYSTEM DETECTION
# ============================================================================

detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        if [[ $(uname -m) == "arm64" ]]; then
            ARCH="arm64"
        else
            ARCH="x64"
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if [ -f /etc/debian_version ]; then
            OS="debian"
        elif [ -f /etc/redhat-release ]; then
            OS="redhat"
        else
            OS="linux"
        fi
        ARCH=$(uname -m)
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        OS="windows"
        ARCH="x64"
    else
        OS="unknown"
        ARCH="unknown"
    fi
}

detect_package_manager() {
    if [[ "$OS" == "macos" ]]; then
        if command_exists brew; then
            PKG_MANAGER="brew"
        else
            PKG_MANAGER="none"
        fi
    elif [[ "$OS" == "debian" ]]; then
        PKG_MANAGER="apt"
    elif [[ "$OS" == "redhat" ]]; then
        if command_exists dnf; then
            PKG_MANAGER="dnf"
        elif command_exists yum; then
            PKG_MANAGER="yum"
        fi
    elif [[ "$OS" == "windows" ]]; then
        if command_exists choco; then
            PKG_MANAGER="choco"
        else
            PKG_MANAGER="none"
        fi
    else
        PKG_MANAGER="none"
    fi
}

# ============================================================================
# PREREQUISITE INSTALLATION FUNCTIONS
# ============================================================================

install_xcode_tools() {
    print_step "Checking Xcode Command Line Tools..."
    
    # Check if Command Line Tools are installed
    if ! xcode-select -p >/dev/null 2>&1; then
        print_step "Installing Xcode Command Line Tools..."
        print_info "This will open a dialog box. Please click 'Install' and wait for completion."
        xcode-select --install
        
        print_info "Waiting for Xcode Command Line Tools installation to complete..."
        print_info "Once installation is finished, please re-run this script."
        print_info "You can check installation status with: xcode-select -p"
        exit 0
    fi
    
    # Verify essential tools are available
    local missing_tools=()
    
    if ! command_exists clang; then
        missing_tools+=("clang")
    fi
    
    if ! command_exists git; then
        missing_tools+=("git")
    fi
    
    if ! command_exists make; then
        missing_tools+=("make")
    fi
    
    if [ ${#missing_tools[@]} -gt 0 ]; then
        print_error "Essential development tools are missing: ${missing_tools[*]}"
        print_info "Please install Xcode Command Line Tools: xcode-select --install"
        print_info "Or reinstall them: sudo xcode-select --reset && xcode-select --install"
        exit 1
    fi
    
    print_success "Xcode Command Line Tools are properly installed"
}

check_system_prerequisites() {
    print_section "Checking System Prerequisites"
    
    if [[ "$OS" == "macos" ]]; then
        # Install/verify Xcode Command Line Tools first
        install_xcode_tools
        
        # Check available disk space (Homebrew + MongoDB need ~3GB)
        local available_space=$(df -g . | tail -1 | awk '{print $4}')
        if [ "$available_space" -lt 4 ]; then
            print_warning "Low disk space detected: ${available_space}GB available"
            print_warning "MongoDB and dependencies require ~3GB. Consider freeing up space."
        else
            print_success "Sufficient disk space available: ${available_space}GB"
        fi
    fi
}

install_homebrew() {
    print_step "Installing Homebrew package manager..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # Add Homebrew to PATH for Apple Silicon
    if [[ "$ARCH" == "arm64" ]]; then
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
        eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
    PKG_MANAGER="brew"
}

validate_homebrew() {
    if [[ "$PKG_MANAGER" == "brew" ]]; then
        print_step "Validating Homebrew installation..."
        
        # Update Homebrew first
        if ! brew update; then
            print_error "Failed to update Homebrew"
            print_info "Check your internet connection and try again"
            exit 1
        fi
        
        # Test basic Homebrew functionality
        if ! brew --version >/dev/null 2>&1; then
            print_error "Homebrew is not functioning properly"
            print_info "Try reinstalling Homebrew or check the installation logs"
            exit 1
        fi
        
        # Test that Homebrew can access its formulae
        if ! brew search --formula hello >/dev/null 2>&1; then
            print_error "Homebrew cannot access package formulae"
            print_info "Check your internet connection and Homebrew configuration"
            exit 1
        fi
        
        # For macOS, verify compilation capability with a simple test
        if [[ "$OS" == "macos" ]]; then
            print_step "Testing Homebrew compilation capability..."
            
            # Create a temporary test to verify compilation works
            if ! echo 'int main(){return 0;}' | clang -x c -o /tmp/homebrew_test - 2>/dev/null; then
                print_error "System cannot compile C programs"
                print_info "Xcode Command Line Tools may not be properly installed"
                print_info "Run: sudo xcode-select --reset && xcode-select --install"
                exit 1
            fi
            
            # Clean up test file
            rm -f /tmp/homebrew_test
        fi
        
        print_success "Homebrew is properly configured and functional"
    fi
}

install_python() {
    local current_version=""
    
    # Check current Python version
    if command_exists python3; then
        current_version=$(python3 --version 2>&1 | cut -d' ' -f2 | cut -d'.' -f1,2)
        if version_compare "$current_version" "$REQUIRED_PYTHON_VERSION"; then
            print_success "Python $current_version is already installed and meets requirements"
            return 0
        fi
    fi
    
    print_step "Installing Python $REQUIRED_PYTHON_VERSION+..."
    
    case "$PKG_MANAGER" in
        "brew")
            brew install python@3.11
            ;;
        "apt")
            sudo apt update
            sudo apt install -y python3.11 python3.11-venv python3.11-pip python3.11-dev
            ;;
        "dnf")
            sudo dnf install -y python3.11 python3.11-pip python3.11-devel
            ;;
        "yum")
            sudo yum install -y python3.11 python3.11-pip python3.11-devel
            ;;
        "choco")
            choco install python --version=3.11.0
            ;;
        *)
            print_error "Unable to install Python automatically on this system"
            print_info "Please install Python $REQUIRED_PYTHON_VERSION+ manually and re-run this script"
            exit 1
            ;;
    esac
    
    print_success "Python installed successfully"
}

install_nodejs() {
    local current_version=""
    
    # Check current Node.js version
    if command_exists node; then
        current_version=$(node --version 2>&1 | sed 's/v//' | cut -d'.' -f1)
        if [ "$current_version" -ge "$REQUIRED_NODE_VERSION" ]; then
            print_success "Node.js v$current_version is already installed and meets requirements"
            return 0
        fi
    fi
    
    print_step "Installing Node.js $REQUIRED_NODE_VERSION+..."
    
    case "$PKG_MANAGER" in
        "brew")
            brew install node@20
            ;;
        "apt")
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
            sudo apt-get install -y nodejs
            ;;
        "dnf")
            sudo dnf install -y nodejs@20 npm
            ;;
        "yum")
            curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
            sudo yum install -y nodejs
            ;;
        "choco")
            choco install nodejs --version=20.0.0
            ;;
        *)
            print_error "Unable to install Node.js automatically on this system"
            print_info "Please install Node.js $REQUIRED_NODE_VERSION+ manually and re-run this script"
            exit 1
            ;;
    esac
    
    print_success "Node.js installed successfully"
}

install_mongodb() {
    # Check if MongoDB is already installed and running
    if command_exists mongod && pgrep mongod > /dev/null; then
        print_success "MongoDB is already installed and running"
        return 0
    fi
    
    print_step "Installing MongoDB Community Edition..."
    
    case "$PKG_MANAGER" in
        "brew")
            # Ensure Homebrew is updated before MongoDB installation
            print_step "Updating Homebrew before MongoDB installation..."
            if ! brew update; then
                print_error "Failed to update Homebrew"
                print_info "Check your internet connection and try: brew doctor"
                exit 1
            fi
            
            # Add MongoDB tap with error handling
            print_step "Adding MongoDB tap..."
            if ! brew tap mongodb/brew; then
                print_error "Failed to add MongoDB tap to Homebrew"
                print_info "This usually indicates:"
                print_info "  1. Internet connection issues"
                print_info "  2. Missing Xcode Command Line Tools"
                print_info "  3. Homebrew configuration problems"
                print_info "Try: brew doctor"
                exit 1
            fi
            
            # Install MongoDB with better error handling
            print_step "Installing MongoDB Community Edition 7.0..."
            if ! brew install mongodb-community@7.0; then
                print_error "MongoDB installation failed"
                print_info "Common causes and solutions:"
                print_info "  1. Missing Xcode Command Line Tools:"
                print_info "     Run: xcode-select --install"
                print_info "  2. Homebrew needs update:"
                print_info "     Run: brew update && brew doctor"
                print_info "  3. Insufficient disk space:"
                print_info "     Free up at least 2GB of space"
                print_info "  4. Architecture conflicts (rare):"
                print_info "     Run: arch -arm64 brew install mongodb-community@7.0"
                exit 1
            fi
            ;;
        "apt")
            # Import MongoDB public GPG key
            print_step "Adding MongoDB GPG key..."
            if ! curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor; then
                print_error "Failed to add MongoDB GPG key"
                exit 1
            fi
            
            # Add MongoDB repository
            print_step "Adding MongoDB repository..."
            echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
            
            # Install MongoDB
            print_step "Installing MongoDB..."
            sudo apt update
            if ! sudo apt install -y mongodb-org; then
                print_error "MongoDB installation failed"
                exit 1
            fi
            ;;
        "dnf"|"yum")
            # Add MongoDB repository
            print_step "Adding MongoDB repository..."
            sudo tee /etc/yum.repos.d/mongodb-org-7.0.repo > /dev/null <<EOF
[mongodb-org-7.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/8/mongodb-org/7.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-7.0.asc
EOF
            
            # Install MongoDB
            print_step "Installing MongoDB..."
            if ! sudo $PKG_MANAGER install -y mongodb-org; then
                print_error "MongoDB installation failed"
                exit 1
            fi
            ;;
        "choco")
            if ! choco install mongodb; then
                print_error "MongoDB installation failed"
                exit 1
            fi
            ;;
        *)
            print_error "Unable to install MongoDB automatically on this system"
            print_info "Please install MongoDB Community Edition manually and re-run this script"
            exit 1
            ;;
    esac
    
    print_success "MongoDB installed successfully"
}

start_mongodb() {
    print_step "Starting MongoDB service..."
    
    case "$OS" in
        "macos")
            if command_exists brew; then
                brew services start mongodb/brew/mongodb-community@7.0
            else
                mongod --config /usr/local/etc/mongod.conf --fork
            fi
            ;;
        "debian"|"redhat"|"linux")
            sudo systemctl start mongod
            sudo systemctl enable mongod
            ;;
        "windows")
            net start MongoDB
            ;;
    esac
    
    # Wait for MongoDB to start
    sleep 3
    
    # Verify MongoDB is running
    if pgrep mongod > /dev/null; then
        print_success "MongoDB is running successfully"
    else
        print_warning "MongoDB may not have started correctly"
        print_info "You may need to start it manually: mongod --dbpath /usr/local/var/mongodb"
    fi
}

# ============================================================================
# PROJECT SETUP FUNCTIONS
# ============================================================================

setup_environment_files() {
    print_step "Setting up environment files..."
    
    # Backend environment
    if [ ! -f "backend/.env" ]; then
        if [ -f "env-examples/backend.env.example" ]; then
            cp env-examples/backend.env.example backend/.env
            print_success "Created backend/.env from example"
        else
            print_error "Backend environment example not found"
            exit 1
        fi
    else
        print_info "Backend .env file already exists"
    fi
    
    # Frontend environment
    if [ ! -f "frontend/.env.local" ]; then
        if [ -f "env-examples/frontend.env.example" ]; then
            cp env-examples/frontend.env.example frontend/.env.local
            print_success "Created frontend/.env.local from example"
        else
            print_error "Frontend environment example not found"
            exit 1
        fi
    else
        print_info "Frontend .env.local file already exists"
    fi
}

setup_python_environment() {
    print_step "Setting up Python virtual environment..."
    
    cd backend
    
    # Create virtual environment if it doesn't exist
    if [ ! -d "venv" ]; then
        python3 -m venv venv
        print_success "Created Python virtual environment"
    else
        print_info "Virtual environment already exists"
    fi
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Upgrade pip
    pip install --upgrade pip
    
    # Install requirements
    if [ -f "requirements.txt" ]; then
        pip install -r requirements.txt
        print_success "Installed Python dependencies"
    else
        print_error "requirements.txt not found"
        exit 1
    fi
    
    cd ..
}

setup_root_dependencies() {
    print_step "Installing root project dependencies..."
    
    if [ -f "package.json" ]; then
        npm install
        print_success "Installed root dependencies (concurrently, dev tools)"
    else
        print_warning "Root package.json not found"
    fi
}

setup_frontend_dependencies() {
    print_step "Installing frontend dependencies..."
    
    cd frontend
    
    if [ -f "package.json" ]; then
        npm install
        print_success "Installed frontend dependencies"
    else
        print_error "Frontend package.json not found"
        exit 1
    fi
    
    cd ..
}

setup_shared_types() {
    print_step "Setting up shared types..."
    
    cd shared
    
    if [ -f "package.json" ]; then
        npm install
        npm run build 2>/dev/null || print_warning "Shared types build failed (may be normal)"
        print_success "Set up shared types"
    else
        print_warning "Shared types package.json not found"
    fi
    
    cd ..
}

# ============================================================================
# VERIFICATION FUNCTIONS
# ============================================================================

verify_installation() {
    print_section "Verifying Installation"
    
    local errors=0
    
    # Check Python
    if command_exists python3; then
        local py_version=$(python3 --version 2>&1 | cut -d' ' -f2)
        print_success "Python $py_version installed"
    else
        print_error "Python installation failed"
        ((errors++))
    fi
    
    # Check Node.js
    if command_exists node; then
        local node_version=$(node --version)
        print_success "Node.js $node_version installed"
    else
        print_error "Node.js installation failed"
        ((errors++))
    fi
    
    # Check MongoDB
    if command_exists mongod; then
        print_success "MongoDB installed"
        if pgrep mongod > /dev/null; then
            print_success "MongoDB is running"
        else
            print_warning "MongoDB is installed but not running"
        fi
    else
        print_error "MongoDB installation failed"
        ((errors++))
    fi
    
    # Check project files
    if [ -f "backend/.env" ] && [ -f "frontend/.env.local" ]; then
        print_success "Environment files configured"
    else
        print_error "Environment files missing"
        ((errors++))
    fi
    
    # Check virtual environment
    if [ -d "backend/venv" ]; then
        print_success "Python virtual environment created"
    else
        print_error "Python virtual environment missing"
        ((errors++))
    fi
    
    return $errors
}

test_connections() {
    print_section "Testing Connections"
    
    # Test MongoDB connection
    if command_exists mongosh; then
        if mongosh --eval "db.runCommand('ping')" >/dev/null 2>&1; then
            print_success "MongoDB connection successful"
        else
            print_warning "MongoDB connection test failed"
        fi
    elif command_exists mongo; then
        if mongo --eval "db.runCommand('ping')" >/dev/null 2>&1; then
            print_success "MongoDB connection successful"
        else
            print_warning "MongoDB connection test failed"
        fi
    fi
    
    # Test backend dependencies
    cd backend
    if [ -d "venv" ]; then
        source venv/bin/activate
        if python -c "import fastapi, pymongo, openai" 2>/dev/null; then
            print_success "Backend dependencies available"
        else
            print_warning "Some backend dependencies may be missing"
        fi
        deactivate
    fi
    cd ..
    
    # Test root dependencies
    if [ -d "node_modules" ]; then
        print_success "Root dependencies installed"
    else
        print_warning "Root dependencies may be missing"
    fi
    
    # Test frontend dependencies
    cd frontend
    if [ -d "node_modules" ]; then
        print_success "Frontend dependencies installed"
    else
        print_warning "Frontend dependencies may be missing"
    fi
    cd ..
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    print_header
    
    # Validate we're in the right directory
    if [ ! -f "package.json" ] || [ ! -d "backend" ] || [ ! -d "frontend" ]; then
        print_error "Please run this script from the $PROJECT_NAME project root directory"
        print_info "Expected structure: package.json, backend/, frontend/"
        exit 1
    fi
    
    print_info "Detected project directory: $(get_project_dir)"
    echo ""
    
    # System detection
    print_section "System Detection"
    detect_os
    detect_package_manager
    
    print_info "Operating System: $OS ($ARCH)"
    print_info "Package Manager: $PKG_MANAGER"
    echo ""
    
    # NEW: Check system prerequisites BEFORE installing anything
    check_system_prerequisites
    echo ""
    
    # Install package manager if needed (macOS)
    if [[ "$OS" == "macos" ]] && [[ "$PKG_MANAGER" == "none" ]]; then
        print_section "Installing Package Manager"
        install_homebrew
        echo ""
    fi
    
    # NEW: Validate package manager health after installation
    if [[ "$PKG_MANAGER" == "brew" ]]; then
        validate_homebrew
        echo ""
    fi
    
    # Install prerequisites
    print_section "Installing Prerequisites"
    
    install_python
    install_nodejs
    install_mongodb
    start_mongodb
    
    echo ""
    
    # Project setup
    print_section "Setting Up Project"
    
    setup_environment_files
    setup_root_dependencies
    setup_python_environment
    setup_frontend_dependencies
    setup_shared_types
    
    echo ""
    
    # Verification
    verify_installation
    local verify_errors=$?
    
    echo ""
    test_connections
    
    echo ""
    
    # Final status
    print_section "Setup Complete"
    
    if [ $verify_errors -eq 0 ]; then
        print_success "🎉 $PROJECT_NAME development environment is ready!"
        echo ""
        print_info "Next steps:"
        echo "  1. Configure your API keys in backend/.env"
        echo "  2. Start the backend: cd backend && source venv/bin/activate && uvicorn main:app --reload"
        echo "  3. Start the frontend: cd frontend && npm run dev"
        echo "  4. Open http://localhost:3000 in your browser"
        echo ""
        print_info "📚 For detailed documentation, see docs/README.md"
    else
        print_error "Setup completed with $verify_errors error(s)"
        print_info "Please review the errors above and run the script again if needed"
        exit 1
    fi
}

# ============================================================================
# SCRIPT EXECUTION
# ============================================================================

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            echo "Usage: $0 [options]"
            echo ""
            echo "ClauseIQ Development Environment Setup Script v$SCRIPT_VERSION"
            echo "================================================================"
            echo ""
            echo "This script automatically installs and configures your complete"
            echo "development environment for ClauseIQ."
            echo ""
            echo "Prerequisites (will be installed automatically on macOS):"
            echo "  • Xcode Command Line Tools (macOS only)"
            echo "  • Package manager (Homebrew/apt/dnf/yum)"
            echo "  • Internet connection"
            echo "  • ~4GB free disk space"
            echo ""
            echo "What this script installs:"
            echo "  • Python 3.8+ with virtual environment"
            echo "  • Node.js 18+ and npm"
            echo "  • MongoDB Community Edition 7.0"
            echo "  • All project dependencies (backend & frontend)"
            echo "  • Environment configuration files"
            echo ""
            echo "Options:"
            echo "  -h, --help     Show this help message"
            echo "  --version      Show script version"
            echo ""
            echo "Supported Systems:"
            echo "  • macOS (Intel & Apple Silicon)"
            echo "  • Ubuntu/Debian Linux"
            echo "  • RHEL/CentOS/Fedora Linux"
            echo "  • Windows WSL"
            echo ""
            echo "For troubleshooting, see: docs/QUICK_START.md"
            exit 0
            ;;
        --version)
            echo "$SCRIPT_VERSION"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
    shift
done

# Run main function
main "$@" 