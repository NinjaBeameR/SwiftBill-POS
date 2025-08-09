# 🚀 Udupi POS Automated Release System

This document explains how to use the automated release system for the Udupi Restaurant POS application.

## 📋 Quick Start

### Automated Releases (Recommended)

```bash
# For bug fixes (1.0.3 → 1.0.4)
npm run release-patch

# For new features (1.0.3 → 1.1.0)
npm run release-minor

# For major changes (1.0.3 → 2.0.0)
npm run release-major
```

### Manual Release

```bash
# Interactive manual release
npm run manual-release

# Direct version specification
./scripts/release.sh 1.0.5        # Linux/Mac
scripts\release.bat 1.0.5         # Windows
```

## 🔄 How It Works

### 1. **Local Process**
- Updates `package.json` version
- Builds and verifies the application locally
- Commits version changes
- Creates and pushes git tag

### 2. **GitHub Actions**
- Automatically triggered by version tags (`v*.*.*`)
- Builds the application on Windows runner
- Creates GitHub release with proper assets
- Uploads installer, portable exe, and `latest.yml`

### 3. **Auto-Update System**
- Existing users automatically notified of new version
- Silent background download of updates
- User-controlled installation process

## 📁 What Gets Built and Released

### Build Artifacts
- **`Udupi Restaurant POS Setup X.X.X.exe`** - Installer for new/existing installations
- **`Udupi-POS-Portable-X.X.X.exe`** - Portable version for USB deployment
- **`latest.yml`** - Critical file for auto-updater functionality

### Release Assets
All build artifacts are automatically uploaded to the GitHub release and made available for:
- Manual downloads
- Auto-updater system
- Distribution partners

## 🎯 Release Types

### Patch Release (X.X.1)
- **Use for**: Bug fixes, security patches, minor improvements
- **Example**: `1.0.3 → 1.0.4`
- **Command**: `npm run release-patch`

### Minor Release (X.1.0)
- **Use for**: New features, enhancements, non-breaking changes
- **Example**: `1.0.3 → 1.1.0`
- **Command**: `npm run release-minor`

### Major Release (1.0.0)
- **Use for**: Breaking changes, major rewrites, API changes
- **Example**: `1.0.3 → 2.0.0`
- **Command**: `npm run release-major`

## 🔧 Prerequisites

### Development Environment
- **Node.js** 18 or higher
- **npm** latest version
- **Git** with proper GitHub authentication
- **Windows** for building (or GitHub Actions handles this)

### Repository Setup
- Clean working directory (no uncommitted changes)
- Push access to the repository
- GitHub Actions enabled

## 📊 Monitoring Releases

### GitHub Actions
Monitor the automated build process:
- **Actions Page**: https://github.com/NinjaBeameR/SwiftBill-POS/actions
- **Build Status**: Real-time progress of builds
- **Build Logs**: Detailed information about each step

### GitHub Releases
View published releases:
- **Releases Page**: https://github.com/NinjaBeameR/SwiftBill-POS/releases
- **Latest Release**: Direct link to most recent version
- **Download Statistics**: Track adoption of new versions

## 🐛 Troubleshooting

### Common Issues

#### "Working directory not clean"
```bash
# Check status
git status

# Commit or stash changes
git add .
git commit -m "Prepare for release"
# OR
git stash
```

#### "Tag already exists"
```bash
# List existing tags
git tag -l

# Delete local tag if needed
git tag -d v1.0.4

# Delete remote tag if needed
git push origin :refs/tags/v1.0.4
```

#### "Build failed"
```bash
# Clean and rebuild
rm -rf node_modules dist
npm install
npm run build-win
```

#### "GitHub Actions not triggering"
- Ensure tag was pushed: `git push origin v1.0.4`
- Check Actions tab for workflow status
- Verify `.github/workflows/release.yml` exists

### Debug Commands

```bash
# Verify git configuration
git remote -v
git config user.name
git config user.email

# Check Node.js setup
node --version
npm --version

# Test build locally
npm run build-win
ls -la dist/
```

## 🔐 Security Considerations

### GitHub Token
The automated system uses `GITHUB_TOKEN` which is automatically provided by GitHub Actions. No additional setup required.

### Build Security
- All builds happen on GitHub's secure runners
- No credentials stored in repository
- All releases are cryptographically signed

## 📝 Release Notes

### Automatic Generation
GitHub Actions automatically generates release notes including:
- Changes since last release
- Installation instructions
- Auto-update information
- System requirements

### Custom Release Notes
You can customize release notes by editing the GitHub release after it's created.

## 🔄 User Experience

### For Existing Users
1. **Automatic Detection**: App checks for updates on startup
2. **Silent Download**: Updates download in background
3. **User Choice**: User decides when to install
4. **Seamless Update**: App restarts with new version

### For New Users
1. **Download**: Get installer from GitHub releases
2. **Install**: Run setup executable
3. **Auto-Update**: Future updates handled automatically

## 📈 Best Practices

### Before Releasing
- [ ] Test all functionality thoroughly
- [ ] Update documentation if needed
- [ ] Ensure all commits are meaningful
- [ ] Verify printer compatibility
- [ ] Test on clean Windows environment

### Release Frequency
- **Patch releases**: As needed for critical fixes
- **Minor releases**: Monthly for feature updates
- **Major releases**: Quarterly or when significant changes warrant

### Version Strategy
Follow semantic versioning strictly:
- `MAJOR.MINOR.PATCH`
- Increment based on type of changes
- Never skip versions
- Keep version history clean

## 🆘 Support

### Getting Help
- **Documentation**: Check this README first
- **Issues**: Create GitHub issue for bugs
- **Discussions**: Use GitHub discussions for questions

### Emergency Procedures
If a release has critical issues:

1. **Immediate**: Don't panic, document the issue
2. **Assess**: Determine if rollback is needed
3. **Fix**: Prepare hotfix patch release
4. **Deploy**: Use `npm run release-patch` for quick fix
5. **Communicate**: Update users via release notes

## 🎉 Success Indicators

### Release Completed Successfully When:
- [ ] GitHub Actions build passes
- [ ] Release appears on GitHub releases page
- [ ] All three files (2 .exe + latest.yml) are uploaded
- [ ] Auto-updater can detect the new version
- [ ] Installation works on clean system

### User Adoption Metrics:
- Download counts on GitHub releases
- Auto-update adoption rates
- User feedback and issue reports

---

**Happy Releasing! 🚀**

The automated release system ensures your Udupi POS updates reach users efficiently and reliably.
