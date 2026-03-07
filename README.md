# MedSuccess App

A comprehensive medication management application built with React Native and Expo for managing client medications, tracking administration, and maintaining medication stock levels.

Medication administration record (MAR) program for disability clients in non-clinical settings.

## Purpose

Provides a simple, auditable way to record medication administration for care staff supporting people with disabilities in non-clinical environments.

## Features

### Core Functionality
- **Multi-Location Management** - Organize clients across different facilities or locations
- **Client Management** - Complete client profiles with demographics, allergies, and photo support
- **Medication Tracking** - Schedule and track medication administration with precise timing
- **Stock Management** - Monitor medication inventory with disposal and collection tracking
- **History & Timeline** - Comprehensive audit trail of all medication-related activities
- **PRN Medications** - Support for as-needed medications

### Stock Management
- Real-time stock level monitoring
- Disposal and collection tracking
- Stock verification with yes/no confirmations (optional)
- Discrepancy reporting with mandatory notes
- Automatic history logging for all stock changes

### Administration Tracking
- Scheduled dose tracking
- On-time/late administration monitoring
- Missed dose recording with reasons
- Manual administration recording
- Multiple dose tracking per day

### Reports & History
- Complete medication history
- Status-based color coding
- Archived medication records
- Stock adjustment audit trail
- Timeline view of upcoming and overdue medications

## Tech Stack

- **Framework**: React Native with Expo
- **Language**: TypeScript
- **Storage**: AsyncStorage (local persistence)
- **Navigation**: React Navigation
- **State Management**: React Hooks (useState, useEffect, useFocusEffect)

## Project Structure

```
MedSuccessApp/
├── screens/             # Screen components
│   ├── HomeScreen.tsx
│   ├── DashboardScreen.tsx
│   ├── LocationsScreen.tsx
│   ├── LocationClientsScreen.tsx
│   ├── ClientDetailsPanel.tsx
│   ├── ClientDetailsScreen.tsx
│   ├── AddClientScreen.tsx
│   ├── AddMedicationScreen.tsx
│   └── StockManagementScreen.tsx
├── src/
│   ├── components/      # Reusable components
│   │   ├── AdminRecordModal.tsx
│   │   ├── DeleteConfirmModal.tsx
│   │   ├── HistoryList.tsx
│   │   └── TimelineList.tsx
│   ├── utils/          # Utility functions
│   │   ├── medicationTimingHelpers.ts
│   │   └── timelineGenerator.ts
│   ├── constants.ts    # App-wide constants
│   ├── validation.ts   # Input validation helpers
│   ├── errorHandling.ts # Error handling utilities
│   ├── storage.ts      # Data persistence layer
│   └── dateTimeUtils.ts # Date/time utilities
├── assets/             # Images and static files
├── App.tsx            # Root component
└── package.json       # Dependencies
```

## Code Architecture

### Constants (`src/constants.ts`)
Centralized constants for consistent UI and validation:
- **COLORS**: Brand colors (primary, success, error, warning)
- **STATUS_COLORS**: Color mapping for medication statuses
- **SPACING**: Consistent spacing scale (xs to xxl)
- **RADIUS**: Border radius values
- **FONT_SIZE**: Typography scale
- **FONT_WEIGHT**: Font weight values
- **SHADOW**: Platform-aware shadow presets
- **ERROR_MESSAGES**: Standardized error text
- **SUCCESS_MESSAGES**: Standardized success text
- **VALIDATION**: Input constraints (min/max values)

Usage example:
```typescript
import { COLORS, SPACING } from '../src/constants';

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
  }
});
```

### Validation (`src/validation.ts`)
Type-safe validation functions for user input:
- `validateRequired(value, fieldName)` - Required field validation
- `validateName(name, fieldName)` - Name field validation with length checks
- `validateNumber(value, fieldName, options)` - Numeric input with min/max
- `validateStock(stock)` - Stock level validation
- `validateDose(dose, fieldName)` - Medication dose validation
- `validateEmail(email)` - Email format validation
- `validateDate(dateStr, fieldName)` - Date string validation
- `sanitizeText(text)` - Trim and normalize whitespace
- `safeParseInt(value, fallback)` - Safe integer parsing
- `safeParseFloat(value, fallback)` - Safe float parsing

All validation functions return:
```typescript
type ValidationResult = {
  isValid: boolean;
  error?: string;
}
```

Usage example:
```typescript
import { validateStock, safeParseInt } from '../src/validation';

const stock = safeParseInt(inputValue, 0);
const result = validateStock(stock);
if (!result.isValid) {
  showError(result.error || 'Invalid stock', 'Validation Error');
  return;
}
```

### Error Handling (`src/errorHandling.ts`)
Consistent error management and user feedback:
- `getErrorMessage(error)` - Extract message from unknown error types
- `showError(error, context?, onOk?)` - Display error alerts
- `showSuccess(message, onOk?)` - Display success messages
- `showConfirmation(title, message, onConfirm, onCancel?)` - Confirmation dialogs
- `logError(error, context?)` - Development-only console logging
- `handleAsync<T>(promise, context?, showAlert?)` - Async error wrapper
- `withErrorHandling<Args, Result>(fn, context?)` - Wraps functions with error handling

Usage example:
```typescript
import { showError, showSuccess, logError } from '../src/errorHandling';

try {
  await saveData(data);
  showSuccess('Data saved successfully');
} catch (error) {
  logError(error, 'Save Data');
  showError(error, 'Failed to save data');
}
```

### Data Storage (`src/storage.ts`)
All data persistence through AsyncStorage:
- Location management (add, update, delete)
- Client CRUD operations
- Medication management
- Administration records
- Stock adjustments

## Data Models

### Location
```typescript
{
  id: string;
  name: string;
  clients: Client[];
}
```

### Client
```typescript
{
  id: string;
  name: string;
  dob?: string;
  gender?: 'Male' | 'Female' | 'Other';
  allergies?: string;
  weight?: string;
  contactEmail?: string;
  photoUri?: string;
  medications?: Medication[];
  archivedMedicationHistory?: ArchivedHistory[];
}
```

### Medication
```typescript
{
  id: string;
  name: string;
  totalDose?: string;
  dosePerTablet?: string;
  route?: string;
  timesPerDay?: number;
  startTime?: string; // ISO format
  endTime?: string; // ISO format
  scheduledTimes?: string[]; // ISO format
  prn?: boolean;
  notes?: string;
  stock?: number;
  administrationRecords?: AdministrationRecord[];
}
```

### Administration Record
```typescript
{
  time: string; // ISO format
  status: 'given' | 'missed' | 'created' | 'deleted' | 'discontinued' | 'stock-adjustment';
  actualTime?: string; // ISO format
  reason?: string;
}
```

## Key Screens

### Stock Management Screen
- Lists all client medications across all locations
- Tracks disposed and collected amounts
- Calculates new stock levels automatically
- Optional stock verification (yes/no confirmations)
- Mandatory discrepancy tracking when verification is "no"
- Creates detailed audit trail in medication history
- Closes automatically after successful update

### Client Details Panel
- Tab-based interface: Medications, Timeline, History
- Real-time medication status display
- Quick administration recording
- Edit medication details inline
- Delete medications with confirmation
- Auto-refresh on screen focus

### History & Timeline
- **History**: Chronological log of all medication actions
- **Timeline**: Upcoming and overdue medications
- Color-coded status indicators (green=given, red=missed, purple=stock-adjustment)
- Detailed action tracking with timestamps
- Archived medication support

## Best Practices

### Error Handling
✅ All async operations wrapped in try/catch  
✅ Use `showError()` instead of raw `Alert.alert()`  
✅ Use `logError()` for development debugging  
✅ Consistent error UI patterns  

Example:
```typescript
// ❌ Don't do this
try {
  await someAsyncOperation();
} catch (e) {
  Alert.alert('Error', String(e));
}

// ✅ Do this
try {
  await someAsyncOperation();
} catch (error) {
  logError(error, 'Operation Name');
  showError(error, 'Failed to complete operation');
}
```

### Validation
✅ Input validation before submission  
✅ Use type-safe validation functions  
✅ Clear error messaging  
✅ Sanitized user input  

Example:
```typescript
// ❌ Don't do this
const num = parseInt(input || '0', 10);

// ✅ Do this
const num = safeParseInt(input, 0);
```

### Styling
✅ Use constants from `COLORS`, `SPACING`, etc.  
✅ Avoid hardcoded hex color values  
✅ Use semantic color names  

Example:
```typescript
// ❌ Don't do this
const styles = {
  container: { backgroundColor: '#fff', padding: 16 },
  text: { color: '#2563eb' }
};

// ✅ Do this
const styles = {
  container: { backgroundColor: COLORS.white, padding: SPACING.lg },
  text: { color: COLORS.primary }
};
```

### State Management
✅ Minimal state where possible  
✅ Local state for UI concerns  
✅ AsyncStorage for persistence  
✅ useFocusEffect for screen updates  

## Development

### Installing Dependencies
```bash
npm install
```

### Running on Web
```bash
npm start -- --web
# or
npm run web
```

### Running on Mobile
```bash
# iOS
npm run ios

# Android
npm run android
```

### Scripts
- `start`: Start Expo dev server
- `android`: Open on Android
- `ios`: Open on iOS
- `web`: Start web build

## Known Issues

### React Native Web - Visual Feedback Limitation
**Issue**: Yes/No button selection in Stock Management doesn't show visual feedback on web despite state updating correctly.

**Status**: State management works (console logs confirm), but React Native Web doesn't re-render with style changes.

**Workaround**: Functional but not visually optimal on web. Verification is optional, so this doesn't block functionality.

**Future**: Test on native platforms (iOS/Android) to confirm if issue is web-specific.

## Future Enhancements

### Planned Features
- Search and filter functionality
- Data export (PDF/CSV reports)
- Medication barcode scanning
- Dark mode support
- Multi-user authentication
- Cloud synchronization
- Push notifications for missed medications
- Analytics dashboard

### Technical Improvements
- Unit test coverage
- E2E testing with Detox
- Performance optimization
- Accessibility improvements (screen readers)
- Strict TypeScript mode
- Code splitting for web
- Error boundary implementation
- Offline-first architecture

## Contributing

When adding new features:
1. ✅ Use constants from `src/constants.ts` for colors, spacing, messages
2. ✅ Add input validation to `src/validation.ts` if needed
3. ✅ Use error handlers from `src/errorHandling.ts`
4. ✅ Follow existing code patterns and conventions
5. ✅ Add TypeScript types for all data structures
6. ✅ Test on both web and mobile platforms (if possible)
7. ✅ Update this README if adding major features

## License

This project is licensed under the 0BSD license (see `package.json`).
