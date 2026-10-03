# Contributing to GlowSnap

Thank you for your interest in contributing to GlowSnap!

GlowSnap is an open-source productivity tool for Linux. Everyone is welcome to contribute, whether you are fixing bugs, improving the UI, adding features, or helping with documentation.

## Getting Started

### 1. Fork the repository

Create your own fork of the repository on GitHub.

### 2. Clone your fork

```bash
git clone https://github.com/YOUR_USERNAME/glowsnap.git
cd glowsnap
```

### 3. Install dependencies

Frontend:

```bash
cd frontend
npm ci
```

Backend:

```bash
cd ..
go mod tidy
```

### 4. Run the application

Start the development environment:

```bash
wails dev
```

---

# Project Structure

```
glowsnap/
├── frontend/        # React + TypeScript UI
├── services/        # Go backend services
│   ├── screenshot/  # Screenshot functionality
│   └── screencast/  # Screen recording functionality
├── tests/           # All test code (frontend + backend)
├── test.sh          # Run the complete validation suite
├── app.go           # Wails application bindings
└── main.go          # Application entry point
```

---

# How You Can Help

## Code Contributions

You can contribute by:

- Adding new features
- Fixing bugs
- Improving performance
- Refactoring code
- Improving accessibility
- Adding tests

## UI/UX Contributions

GlowSnap focuses on a clean and minimal experience.

Design contributions are welcome:

- Better animations
- Improved workflows
- Better icons
- Interface improvements

## Documentation

You can help by:

- Improving README files
- Writing tutorials
- Translating documentation

---

# Creating a Pull Request

Before submitting a PR:

1. Create a new branch:

```bash
git checkout -b feature/my-feature
```

2. Make your changes.

3. Run the full test suite (this is exactly what CI runs):

```bash
./test.sh
```

4. Commit your changes:

```bash
git commit -m "feat: add new feature"
```

5. Push your branch:

```bash
git push origin feature/my-feature
```

6. Open a Pull Request.

---

# Commit Style

We use conventional commits:

```
feat: add new feature
fix: fix screenshot bug
refactor: improve code structure
docs: update documentation
```

---

# Code Guidelines

- Keep code simple and readable.
- Follow existing project patterns.
- Avoid unnecessary dependencies.
- Test your changes before submitting (`./test.sh`).
- Put new tests under `tests/`, not next to the source they cover.
- Write clear commit messages.

---

# Community

Every contribution matters

Thank you for helping make GlowSnap better!

```

```
