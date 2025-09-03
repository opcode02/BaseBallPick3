# Manual Test Checklist

## Pre-Refactoring Verification

This checklist ensures all functionality works correctly before refactoring the app into smaller files.

### Setup Phase Tests
- [ ] App loads to setup screen
- [ ] "Start Draft" button is visible
- [ ] Lineup refresh button works
- [ ] Default batters (1-9) are displayed
- [ ] Scoring rules are displayed correctly
- [ ] Reset button clears all data

### Lineup Loading Tests
- [ ] Refresh button shows loading state
- [ ] Successful lineup load updates batter names
- [ ] Network error shows error message
- [ ] Game time displays correctly
- [ ] Drafting window warning appears when appropriate

### Draft Phase Tests
- [ ] Draft screen displays after clicking "Start Draft"
- [ ] Can select exactly 3 batters
- [ ] Cannot select more than 3 batters
- [ ] Selected batters show as "Selected"
- [ ] "Next: Boosters" button enables when 3 picked
- [ ] Back button returns to setup
- [ ] Drafting disabled when window closed

### Booster Phase Tests
- [ ] Booster sliders appear for selected batters
- [ ] Sliders always sum to 100%
- [ ] Moving one slider adjusts others proportionally
- [ ] "Start Live Scoring" button requires 100% allocation
- [ ] Can return to draft phase (if drafting still allowed)

### Live Scoring Tests
- [ ] Live scoring starts with valid game ID
- [ ] Score updates every 15 seconds
- [ ] Manual refresh works
- [ ] Player headshots load (or show initials)
- [ ] Score breakdown displays correctly
- [ ] Boost percentages apply correctly
- [ ] Negative scores not boosted
- [ ] Game state shows (inning, status)

### Results Phase Tests
- [ ] Transitions to results when game ends
- [ ] Final scores displayed
- [ ] Score breakdown shows all stats
- [ ] Share button copies formatted text
- [ ] "New Draft" available if drafting still allowed
- [ ] Reset button clears everything

### State Persistence Tests
- [ ] App saves progress when backgrounded
- [ ] Progress restored when app reopened
- [ ] Old state cleared after 24 hours
- [ ] Score viewing window respected
- [ ] State cleared 10 minutes before next game

### Error Handling Tests
- [ ] Network errors display friendly messages
- [ ] Invalid API responses handled gracefully
- [ ] App doesn't crash on unexpected data
- [ ] Loading states show during API calls
- [ ] Timeouts handled appropriately

### Edge Cases
- [ ] Empty lineup handles gracefully
- [ ] Missing player data shows "TBD"
- [ ] Invalid game dates default to allowing drafting
- [ ] Decimal boost values rounded correctly
- [ ] Very large/small scores handled
- [ ] Special characters in player names

### Performance Tests
- [ ] App loads quickly
- [ ] Smooth scrolling in draft list
- [ ] Animations don't lag
- [ ] Memory usage reasonable
- [ ] No memory leaks during long sessions

### Utility Function Tests

#### Date Utils
- [ ] `formatDateMMDDYYYYInTZ()` formats correctly
- [ ] `formatLocalTime()` handles all inputs
- [ ] `isDraftingAllowed()` calculates correctly
- [ ] `isScoreViewingAllowed()` works with API

#### Scoring Utils
- [ ] `buildScoreFromStatsAndPlays()` parses MLB data
- [ ] All scoring events calculated correctly
- [ ] `applyBoost()` only boosts positive scores
- [ ] Negative scores pass through unchanged

#### General Utils
- [ ] `initials()` handles all name formats
- [ ] `normalizeBoostersToHundred()` maintains 100 total
- [ ] `validateBoostersComplete()` catches all cases

## Refactoring Readiness Checklist

Before starting refactoring:
- [ ] All manual tests pass
- [ ] Unit tests written for utilities
- [ ] Integration test scenarios documented
- [ ] API endpoints and data structures documented
- [ ] State management patterns identified
- [ ] Component boundaries defined
- [ ] Error handling patterns catalogued
- [ ] Performance benchmarks recorded

## Post-Refactoring Verification

After refactoring into separate files:
- [ ] All manual tests still pass
- [ ] Unit tests still pass
- [ ] No regression in functionality
- [ ] Performance maintained or improved
- [ ] Code organization improved
- [ ] Type safety maintained
- [ ] Documentation updated

## Notes

Record any issues found during testing:

```
Date: ___________
Issue: _________________________________________________________________
Steps to reproduce: ____________________________________________________
Expected: _____________________________________________________________
Actual: _______________________________________________________________
Severity: [ ] Critical [ ] High [ ] Medium [ ] Low
```
