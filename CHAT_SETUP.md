# Chat System Setup Guide

## Firebase Configuration

1. **Enable Realtime Database** in your Firebase project
2. **Set up Authentication** (if not already done)
3. **Deploy Security Rules** to your Realtime Database:

```bash
firebase deploy --only database
```

## Security Rules

The security rules ensure:
- Only authenticated users can access chats
- Users can only access chats they're part of
- Message validation ensures proper data structure

## Usage

### Adding Chat Button to Posts

```tsx
import ChatButton from '@/components/ChatButton';

// In your post component
<ChatButton postCreatorId={post.userId}>
  Message Seller
</ChatButton>
```

### Route Structure

The chat system is available at `/realtime-chat/{chatId}` to avoid conflicts with the existing Firestore-based chat system.

### Chat ID Generation

Chat IDs are automatically generated using the format: `user1_user2` (sorted alphabetically)

### Features

- ✅ Real-time message sync
- ✅ Message bubble styling (sent/received)
- ✅ Timestamps with dayjs
- ✅ Auto-scroll to latest message
- ✅ Enter key to send
- ✅ Authentication required
- ✅ Responsive design
- ✅ Message persistence
- ✅ Security rules

## File Structure

```
src/
├── components/
│   ├── ChatButton.tsx      # Button to initiate chats
│   ├── ChatWindow.tsx      # Message display component
│   ├── MessageInput.tsx    # Message input component
│   └── PostWithChat.tsx    # Example post component with chat
├── lib/
│   ├── chatUtils.ts        # Chat ID generation utilities
│   └── firebase.ts         # Firebase configuration
└── app/
    └── realtime-chat/
        └── [chatId]/
            └── page.tsx    # Main chat page
```

## Dependencies

- `react-firebase-hooks` - Firebase authentication hooks
- `dayjs` - Date formatting
- `firebase` - Firebase SDK

## Environment Variables

Make sure your Firebase config includes the `databaseURL` for Realtime Database:

```typescript
const firebaseConfig = {
  // ... other config
  databaseURL: "https://your-project-default-rtdb.firebaseio.com"
};
``` 