# Pick 3 Baseball App

A React Native app for drafting and tracking baseball player performance in a fantasy baseball format focused on the Minnesota Twins.

## Project Structure

```
pick3/
├── App.tsx                          # Main application component
├── src/
│   ├── utils/                       # Utility functions
│   │   ├── dateUtils.ts            # Date formatting and game timing logic
│   │   ├── scoringUtils.ts         # Baseball scoring calculations
│   │   ├── generalUtils.ts         # General helper functions
│   │   └── __tests__/              # Unit tests for utilities
│   │       ├── dateUtils.test.ts
│   │       ├── scoringUtils.test.ts
│   │       └── generalUtils.test.ts
│   ├── history/                    # Historical score tracking
│   │   ├── index.ts               # Game history management
│   │   └── __tests__/             # History functionality tests
│   │       └── index.test.ts
│   ├── storage/                    # Data persistence
│   │   ├── index.ts               # AsyncStorage wrapper and app state
│   │   └── __tests__/             # Storage functionality tests
│   │       └── index.test.ts
│   ├── api/                        # MLB API integration
│   │   └── index.ts               # MLB Stats API client
│   ├── game/                       # Game logic and timing
│   │   └── index.ts               # Score viewing windows and game rules
│   ├── types/                      # TypeScript type definitions
│   │   ├── index.ts               # All app type definitions
│   │   ├── jest.d.ts              # Jest type extensions
│   │   └── __tests__/             # Type validation tests
│   │       └── index.test.ts
│   └── test-setup.ts               # Jest test configuration
├── package.json
├── tsconfig.json
├── jest.config.js
└── babel.config.js
```

## Features

### Core Functionality
- **Player Drafting**: Select 3 batters from the Minnesota Twins lineup
- **Boost System**: Distribute 100 boost points across your picks to multiply positive scores
- **Live Scoring**: Real-time score tracking using MLB Stats API
- **Historical Tracking**: Automatic storage of completed games with player scores and team results
- **Statistics Dashboard**: View your performance history, averages, and best scores
- **Time-Limited Drafting**: Drafting closes 5 minutes after game start
- **Score Viewing Window**: View results until 10 minutes before next game

### Scoring System
- **1B**: +10 points
- **2B**: +20 points  
- **3B**: +30 points
- **HR Solo**: +40 points
- **HR 2-Run**: +45 points
- **HR 3-Run**: +50 points
- **HR Grand Slam**: +80 points
- **BB/HBP**: +5 points each
- **RBI (non-HR)**: +15 points
- **Run Scored (non-HR)**: +15 points
- **Strikeout**: -5 points
- **GIDP**: -10 points
- **Fielder's Choice**: +2 points

### State Management
- **Persistent Storage**: Saves progress using AsyncStorage
- **State Restoration**: Automatically restores drafts and game progress
- **Smart Expiration**: Clears old state based on game timing

## Testing

### Test Categories

#### 1. Unit Tests (`src/utils/__tests__/`)

**Date Utilities (`dateUtils.test.ts`)**
- Date formatting for different timezones
- Game timing validation (drafting window)
- Score viewing window logic
- Edge cases and error handling

**Scoring Utilities (`scoringUtils.test.ts`)**
- Baseball stat parsing and calculation
- Different types of scoring events
- Boost application logic
- Score breakdown generation

**General Utilities (`generalUtils.test.ts`)**
- Name initial generation
- Booster normalization (always sum to 100)
- Validation functions

#### 2. Integration Tests (`src/__tests__/`)

**App Integration (`App.integration.test.tsx`)**
- Full app workflow testing
- State persistence and restoration
- API integration mocking
- User interaction flows
- Error handling scenarios

### Running Tests

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Test Configuration

- **Jest**: Testing framework with React Native preset
- **Testing Library**: Component testing utilities
- **Mocking**: Comprehensive mocking of:
  - AsyncStorage for state persistence
  - Expo Clipboard for sharing functionality
  - MLB API calls for lineup and live data
  - Date/time for consistent testing

## API Integration

### MLB Stats API
- **Schedule Endpoint**: Fetch today's Twins games
- **Live Feed Endpoint**: Real-time game data and player stats
- **Lineup Data**: Player names and batting order

### Data Flow
1. **Setup Phase**: Load today's Twins lineup
2. **Draft Phase**: User selects 3 players and assigns boosts
3. **Live Phase**: Continuous polling for updated player stats
4. **Results Phase**: Final scores with detailed breakdowns

## Key Functions for Refactoring

When breaking this into smaller files, consider these main functional areas:

### 1. State Management (`src/state/`)
- `AppState` interface and related types
- `saveAppState()`, `loadAppState()`, `clearAppState()`
- State validation and migration logic

### 2. API Layer (`src/api/`)
- MLB API client functions
- Data transformation utilities
- Error handling and retry logic

### 3. Game Logic (`src/game/`)
- Drafting rules and validation
- Scoring calculations and boost application
- Game timing and phase transitions

### 4. Utilities (already created in `src/utils/`)
- Date/time functions
- Scoring calculations
- General helper functions

## Development Guidelines

### Code Organization
- Keep utility functions pure and testable
- Separate business logic from UI components
- Use TypeScript for type safety
- Implement proper error handling

### Testing Strategy
- Unit test all utility functions
- Integration test user workflows
- Mock external dependencies
- Test edge cases and error scenarios

### Performance Considerations
- Minimize API calls with smart caching
- Use React.memo for expensive components
- Implement proper loading states
- Handle large datasets efficiently
