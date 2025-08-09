#!/bin/bash
# Automated Release Script for SwiftBill-POS
# Usage: ./scripts/release.sh <version>
# Example: ./scripts/release.sh 1.0.4

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# ASCII Art Header
print_header() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════╗"
    echo "║      SWIFTBILL-POS RELEASE TOOL      ║"
    echo "║     Restaurant Billing Software      ║"
    echo "╚══════════════════════════════════════╝"
    echo -e "${NC}"
}

print_header

# Check if version is provided
if [ -z "$1" ]; then
    print_error "Usage: ./scripts/release.sh <version>"
    print_error "Example: ./scripts/release.sh 1.0.4"
    echo ""
    print_status "Available shortcuts:"
    echo "  npm run release-patch  (for bug fixes: 1.0.3 → 1.0.4)"
    echo "  npm run release-minor  (for features: 1.0.3 → 1.1.0)"
    echo "  npm run release-major  (for major changes: 1.0.3 → 2.0.0)"
    exit 1
fi

VERSION=$1
TAG="v$VERSION"

print_step "Starting release process for version $VERSION"

# Verify we're on main branch
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
if [ "$CURRENT_BRANCH" != "main" ]; then
    print_warning "You are on branch '$CURRENT_BRANCH', not 'main'"
    echo -n "Continue anyway? (y/N): "
    read -r REPLY
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Release cancelled"
        exit 1
    fi
fi

# Check if working directory is clean
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
    print_error "Working directory is not clean. Please commit or stash changes."
    git status --short
    exit 1
fi

# Check if tag already exists
if git tag -l | grep -q "^$TAG$"; then
    print_error "Tag $TAG already exists!"
    print_status "Existing tags:"
    git tag -l | tail -5
    exit 1
fi

# Pull latest changes
print_step "Pulling latest changes from origin..."
git pull origin main

# Update package.json version
print_step "Updating package.json version to $VERSION..."

# Use Node.js to update version in package.json (cross-platform)
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '$VERSION';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\\n');
console.log('✓ Updated package.json version to $VERSION');
"

# Verify Node.js and npm are available
print_step "Verifying build environment..."
node --version
npm --version

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    print_step "Installing dependencies..."
    npm install
fi

# Build the application locally to verify
print_step "Building application locally for verification..."
npm run build-win

# Check if build artifacts exist
if [ ! -f "dist/latest.yml" ]; then
    print_error "Build failed - latest.yml not found"
    print_status "Contents of dist folder:"
    ls -la dist/ || echo "dist folder not found"
    exit 1
fi

# Look for installer file (flexible naming)
INSTALLER_FILE=$(find dist/ -name "*.exe" -name "*Setup*" | head -1)
if [ -z "$INSTALLER_FILE" ]; then
    print_error "Build failed - installer not found"
    print_status "Contents of dist folder:"
    ls -la dist/
    exit 1
fi

print_status "Build verification successful!"
print_status "✓ Found installer: $(basename "$INSTALLER_FILE")"
print_status "✓ Found latest.yml for auto-updater"

# Commit version changes
print_step "Committing version changes..."
git add package.json
if [ -f "package-lock.json" ]; then
    git add package-lock.json
fi

git commit -m "chore: bump version to $VERSION

- Updated package.json version
- Prepared for release $TAG
- Auto-update system ready for deployment"

# Create and push tag
print_step "Creating and pushing tag $TAG..."
git tag -a $TAG -m "Release $TAG

## 🚀 SwiftBill-POS $VERSION

### 📱 Restaurant POS Features
- Complete billing and order management
- Table and counter service support
- KOT (Kitchen Order Ticket) printing
- Thermal printer integration
- Menu management system

### 🔄 Auto-Update System
- Silent background updates
- User-controlled installation
- Persistent update preferences
- Professional notification system

### 💾 Installation
Download the installer or portable version from the release assets.
Existing users will be automatically notified of this update.

### 🛠️ Technical Improvements
- Enhanced printer compatibility
- Improved error handling
- Better user experience
- Optimized performance"

# Push changes and tag
print_step "Pushing changes to GitHub..."
git push origin main
git push origin $TAG

# Success message
echo ""
print_status "🎉 Release process initiated successfully!"
echo ""
print_status "GitHub Actions will now:"
print_status "  ✓ Build the application on Windows runner"
print_status "  ✓ Create GitHub release with proper assets"
print_status "  ✓ Upload installer, portable, and latest.yml"
print_status "  ✓ Enable auto-updater for existing users"
echo ""
print_status "📊 Monitor progress:"
print_status "  Actions: https://github.com/NinjaBeameR/SwiftBill-POS/actions"
print_status "  Release: https://github.com/NinjaBeameR/SwiftBill-POS/releases/tag/$TAG"
echo ""
print_status "🔔 Existing POS users will be notified automatically!"
print_status "   The auto-updater will detect this release and offer installation."
echo ""
print_status "✅ Automated release process complete!"

# Cleanup build files
print_step "Cleaning up local build files..."
if [ -d "dist" ]; then
    rm -rf dist/
    print_status "✓ Cleaned local build artifacts"
fi
