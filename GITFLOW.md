# GitFlow Workflow - Away Project

## Branch Structure

```
main    - Production-ready code (stable)
  ↑
dev     - Integration branch (exact copy of main)
  ↑
server  - Feature branch for server development
```

## Branches (Current State)

- `main` - production-ready code
- `dev` - exact copy of main ✅
- `server` - feature branch for server setup ✅

All branches currently at commit: `34f58c2 refactor: optimize css and visualizer speed`

## GitFlow Workflow

### 1. Creating a Feature Branch (ALWAYS from dev)

```bash
git checkout dev
git checkout -b feature-name
```

### 2. Working on Feature Branch

```bash
git add .
git commit -m "feat: description of changes"
```

### 3. When Feature is Complete

**Step 1:** Merge feature into `dev` (integration testing)
```bash
git checkout dev
git merge feature-name
```

**Step 2:** Test `dev` to make sure nothing breaks
- Run tests
- Check that the app works
- Verify no regressions

**Step 3:** Merge `dev` into `main` (production release)
```bash
git checkout main
git merge dev
git push origin main
```

## Important Rules

⚠️ **NEVER merge directly to `main`** - Always go through `dev` first

✅ **Always create feature branches FROM `dev`** - Not from `main`

✅ **Test on `dev` before releasing to `main`** - This is your safety net

## Commands Reference

### Check current branch
```bash
git branch
```

### Switch branches
```bash
git checkout branch-name
```

### Create new feature branch
```bash
git checkout dev
git checkout -b feature-name
```

### Merge feature to dev
```bash
git checkout dev
git merge feature-name
```

### Merge dev to main (after testing)
```bash
git checkout main
git merge dev
```

### Check branch status
```bash
git branch -v       # Show branches with latest commit
git status          # Check working tree
```

## Current Project Flow Example

For the `server` branch:

```bash
# 1. Work on server feature
git checkout server
# ... make changes ...
git add .
git commit -m "feat: add server functionality"

# 2. When ready, merge to dev first
git checkout dev
git merge server

# 3. Test everything on dev branch
# ... run tests, verify app works ...

# 4. If dev is stable, merge to main
git checkout main
git merge dev
git push origin main
```

## Visual Workflow

```
main (production)
  ↑
  | (merge after testing)
  |
dev (integration)
  ↑
  | (merge when feature complete)
  |
server (feature development)
```

---

**Remember:** `dev` is your testing ground. `main` should always be stable and deployable.
