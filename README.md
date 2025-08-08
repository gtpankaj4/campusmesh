# Campesh - Your campus, your network

A comprehensive campus community platform built with Next.js 14, TypeScript, and Tailwind CSS, featuring reputation systems, private communities, real-time messaging, and anti-spam measures.

## Features

### 🎯 **Core Features**
- **Responsive Design**: Mobile-first design with native app-like experience
- **Firebase Authentication**: Secure .edu email-only authentication
- **Real-time Updates**: Live posts, comments, and messages
- **Cross-platform**: Works seamlessly on mobile, tablet, and desktop

### 🏆 **Reputation System**
- **Smart Karma**: Earn reputation through meaningful interactions
- **Reputation Badges**: Visual indicators based on activity level
- **Anti-spam Protection**: Prevents abuse through reputation gates
- **Activity Rewards**: 
  - Create post: +10 reputation
  - Comment on post: +5 reputation
  - Receive comment: +5 reputation
  - Community post: +5 reputation

### 💬 **Communication Features**
- **Private Messaging**: Direct chat between users
- **Post Comments**: Public discussions on posts
- **Contact System**: Easy user-to-user communication
- **Real-time Chat**: Instant messaging with live updates

### 🏘️ **Community System**
- **Private Communities**: Create exclusive groups for classes, clubs, etc.
- **Anonymous Posts**: Privacy option for sensitive discussions
- **Community Moderation**: Reputation-based access control
- **Anti-spam Measures**: Rate limiting and quality controls

### 🛡️ **Anti-Spam & Quality Control**
- **Reputation Gates**: Minimum reputation requirements for features
- **Rate Limiting**: Max 3 posts per hour in communities
- **Quality Filters**: Minimum reputation for community access
- **Activity Monitoring**: Prevents karma farming and spam

### 📱 **Mobile-First Design**
- **Native App Feel**: Bottom navigation, swipe gestures
- **Touch Optimized**: Large buttons, proper spacing
- **Offline Ready**: Progressive web app capabilities
- **Responsive Layout**: Adapts to all screen sizes

## Tech Stack

- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe JavaScript
- **Tailwind CSS**: Utility-first CSS framework
- **Firebase**: Authentication, Firestore, and real-time updates
- **Heroicons**: Beautiful icon library
- **Google Fonts**: Poppins font family

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd campesh
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/
│   ├── dashboard/
│   │   └── page.tsx          # Main dashboard with posts
│   ├── profile/
│   │   └── page.tsx          # User profile and stats
│   ├── login/
│   │   └── page.tsx          # Authentication page
│   ├── globals.css           # Global styles
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Home page (redirects to login)
├── components/
│   ├── RepBadge.tsx          # Reputation badge component
│   ├── Chat.tsx              # Private messaging component
│   ├── Comment.tsx           # Post comments component
│   └── Community.tsx         # Private communities component
├── lib/
│   └── firebase.ts           # Firebase configuration
└── middleware.ts             # Next.js middleware
```

## Firebase Configuration

The application uses Firebase for all backend services. The configuration is set up in `src/lib/firebase.ts` with the following services:

- **Authentication**: .edu email-only authentication
- **Firestore**: Real-time database for posts, comments, messages, and user profiles
- **Analytics**: User behavior tracking and insights

## Features in Detail

### 🏆 **Reputation System**

The platform uses a sophisticated reputation system to encourage quality interactions and prevent spam:

- **Earning Reputation**:
  - Creating a post: +10 reputation
  - Commenting on a post: +5 reputation
  - Receiving a comment on your post: +5 reputation
  - Posting in communities: +5 reputation

- **Reputation Badges**:
  - 0-99: 💫 Newcomer
  - 100-199: 🌟 Rising Star
  - 200-499: 🏆 Trusted Member
  - 500-999: ⭐ Community Leader
  - 1000+: 👑 Campus Legend

- **Anti-Spam Measures**:
  - Minimum 50 reputation required for community posts
  - Rate limiting: Max 3 posts per hour in communities
  - Quality gates prevent low-effort content

### 💬 **Communication Features**

- **Private Messaging**: Direct chat between users with real-time updates
- **Post Comments**: Public discussions with reputation tracking
- **Contact System**: Easy user-to-user communication
- **Real-time Updates**: Live notifications and message delivery

### 🏘️ **Community System**

- **Private Communities**: Create exclusive groups for classes, study groups, clubs
- **Anonymous Posts**: Privacy option for sensitive discussions
- **Moderation Tools**: Reputation-based access control
- **Quality Control**: Anti-spam measures and content filtering

### 📱 **Mobile Experience**

- **Native App Feel**: Bottom navigation, swipe gestures, touch optimization
- **Responsive Design**: Adapts perfectly to all screen sizes
- **Offline Capabilities**: Progressive web app features
- **Fast Performance**: Optimized for mobile networks

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Deployment

The application can be deployed to Vercel, Netlify, or any other platform that supports Next.js.

### Environment Variables

No environment variables are required as Firebase configuration is included in the code. For production, consider moving Firebase config to environment variables.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source and available under the [MIT License](LICENSE).
