import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

// Sample communities with submesses
export const sampleCommunities = [
  {
    name: "Nepalese Student Association of ULM",
    description: "A community for Nepalese students at ULM to connect, share resources, and support each other.",
    category: "social" as const,
    isPrivate: false,
    allowAnonymous: false,
    university: "ULM",
    tags: ["nepal", "international", "culture"],
    submesses: [
      { id: "1", name: "All", description: "General posts for the community", color: "bg-gray-100 text-gray-800" },
      { id: "2", name: "Rides", description: "Carpooling and transportation", color: "bg-blue-100 text-blue-800" },
      { id: "3", name: "Housing", description: "Roommate searches and housing", color: "bg-green-100 text-green-800" },
      { id: "4", name: "Books", description: "Textbook exchanges and study materials", color: "bg-purple-100 text-purple-800" },
      { id: "5", name: "Help", description: "Academic help and questions", color: "bg-orange-100 text-orange-800" }
    ]
  },
  {
    name: "CSCI 2000 Fall 2025",
    description: "Study group and discussion forum for CSCI 2000 students in Fall 2025 semester.",
    category: "class" as const,
    isPrivate: false,
    allowAnonymous: false,
    university: "ULM",
    semester: "Fall 2025",
    courseCode: "CSCI 2000",
    tags: ["computer science", "programming", "study"],
    submesses: [
      { id: "1", name: "All", description: "General posts for the class", color: "bg-gray-100 text-gray-800" },
      { id: "2", name: "Assignments", description: "Homework help and assignment discussions", color: "bg-red-100 text-red-800" },
      { id: "3", name: "Study Groups", description: "Form study groups and find study partners", color: "bg-blue-100 text-blue-800" },
      { id: "4", name: "Office Hours", description: "Questions for office hours and TA sessions", color: "bg-green-100 text-green-800" },
      { id: "5", name: "Resources", description: "Share study materials and resources", color: "bg-yellow-100 text-yellow-800" }
    ]
  },
  {
    name: "ULM International Students",
    description: "Connect with other international students at ULM.",
    category: "social" as const,
    isPrivate: false,
    allowAnonymous: false,
    university: "ULM",
    tags: ["international", "students", "culture"],
    submesses: [
      { id: "1", name: "All", description: "General posts for international students", color: "bg-gray-100 text-gray-800" },
      { id: "2", name: "Events", description: "Cultural events and activities", color: "bg-purple-100 text-purple-800" },
      { id: "3", name: "Support", description: "Support and advice for international students", color: "bg-pink-100 text-pink-800" },
      { id: "4", name: "Language Exchange", description: "Find language exchange partners", color: "bg-indigo-100 text-indigo-800" }
    ]
  },
  {
    name: "ULM Computer Science Club",
    description: "Official computer science club at ULM. Join us for coding competitions, workshops, and networking events.",
    category: "club" as const,
    isPrivate: false,
    allowAnonymous: false,
    university: "ULM",
    tags: ["computer science", "programming", "club"],
    submesses: [
      { id: "1", name: "All", description: "General club announcements and discussions", color: "bg-gray-100 text-gray-800" },
      { id: "2", name: "Events", description: "Upcoming events and workshops", color: "bg-blue-100 text-blue-800" },
      { id: "3", name: "Projects", description: "Share and collaborate on coding projects", color: "bg-green-100 text-green-800" },
      { id: "4", name: "Competitions", description: "Coding competitions and hackathons", color: "bg-purple-100 text-purple-800" },
      { id: "5", name: "Resources", description: "Learning resources and tutorials", color: "bg-orange-100 text-orange-800" }
    ]
  },
  {
    name: "ULM Housing & Roommates",
    description: "Find roommates, housing options, and apartment recommendations near ULM campus.",
    category: "social" as const,
    isPrivate: false,
    allowAnonymous: false,
    university: "ULM",
    tags: ["housing", "roommates", "apartments"],
    submesses: [
      { id: "1", name: "All", description: "General housing discussions", color: "bg-gray-100 text-gray-800" },
      { id: "2", name: "Roommate Search", description: "Find roommates or room available", color: "bg-blue-100 text-blue-800" },
      { id: "3", name: "Apartments", description: "Apartment listings and reviews", color: "bg-green-100 text-green-800" },
      { id: "4", name: "Housing Tips", description: "Tips and advice for housing", color: "bg-purple-100 text-purple-800" }
    ]
  }
];

// Sample posts for testing
export const samplePosts = [
  // NSA ULM Posts
  {
    title: "Looking for ride to Walmart this weekend",
    description: "Anyone going to Walmart this weekend? I need to buy some groceries and would appreciate a ride. Will share gas money!",
    type: "Rides",
    communityName: "Nepalese Student Association of ULM",
    submessName: "Rides"
  },
  {
    title: "Roommate needed for next semester",
    description: "Looking for a roommate for a 2-bedroom apartment near campus. Rent is $500/month. Must be clean and quiet.",
    type: "Housing",
    communityName: "Nepalese Student Association of ULM",
    submessName: "Housing"
  },
  {
    title: "Selling Calculus textbook",
    description: "Selling my Calculus textbook from last semester. Good condition, $30. DM if interested.",
    type: "Books",
    communityName: "Nepalese Student Association of ULM",
    submessName: "Books"
  },
  {
    title: "Need help with homework",
    description: "Struggling with the latest assignment. Anyone available to help?",
    type: "Help",
    communityName: "Nepalese Student Association of ULM",
    submessName: "Help"
  },
  {
    title: "Carpool to airport",
    description: "Anyone driving to the airport this Friday? My flight is at 3 PM.",
    type: "Rides",
    communityName: "Nepalese Student Association of ULM",
    submessName: "Rides"
  },
  {
    title: "Looking for apartment",
    description: "Searching for a 1-bedroom apartment near campus. Budget is $600/month.",
    type: "Housing",
    communityName: "Nepalese Student Association of ULM",
    submessName: "Housing"
  },
  {
    title: "Buying Physics textbook",
    description: "Looking to buy Physics 101 textbook. Let me know if you have one for sale.",
    type: "Books",
    communityName: "Nepalese Student Association of ULM",
    submessName: "Books"
  },

  // CSCI 2000 Posts
  {
    title: "Assignment 3 due date clarification",
    description: "Is Assignment 3 due this Friday or next Monday? The syllabus seems unclear.",
    type: "Assignments",
    communityName: "CSCI 2000 Fall 2025",
    submessName: "Assignments"
  },
  {
    title: "Study group for midterm",
    description: "Forming a study group for the upcoming midterm. Anyone interested?",
    type: "Study Groups",
    communityName: "CSCI 2000 Fall 2025",
    submessName: "Study Groups"
  },
  {
    title: "Office hours question",
    description: "Will there be office hours this week? I have some questions about the last lecture.",
    type: "Office Hours",
    communityName: "CSCI 2000 Fall 2025",
    submessName: "Office Hours"
  },
  {
    title: "Useful programming resources",
    description: "Found some great online resources for learning the concepts we covered. Sharing here!",
    type: "Resources",
    communityName: "CSCI 2000 Fall 2025",
    submessName: "Resources"
  },
  {
    title: "Assignment 2 solution help",
    description: "Stuck on problem 3 of Assignment 2. Anyone figured it out?",
    type: "Assignments",
    communityName: "CSCI 2000 Fall 2025",
    submessName: "Assignments"
  },
  {
    title: "Study partner needed",
    description: "Looking for a study partner for the final exam. Available evenings and weekends.",
    type: "Study Groups",
    communityName: "CSCI 2000 Fall 2025",
    submessName: "Study Groups"
  },
  {
    title: "TA session schedule",
    description: "What's the TA session schedule for this week?",
    type: "Office Hours",
    communityName: "CSCI 2000 Fall 2025",
    submessName: "Office Hours"
  },

  // ULM International Students Posts
  {
    title: "International Student Welcome Event",
    description: "Join us for the international student welcome event this Friday at 6 PM in the Student Center!",
    type: "Events",
    communityName: "ULM International Students",
    submessName: "Events"
  },
  {
    title: "Looking for Spanish conversation partner",
    description: "I'm learning Spanish and looking for a conversation partner. Anyone interested?",
    type: "Language Exchange",
    communityName: "ULM International Students",
    submessName: "Language Exchange"
  },
  {
    title: "Visa renewal help needed",
    description: "Need help with visa renewal process. Anyone been through this recently?",
    type: "Support",
    communityName: "ULM International Students",
    submessName: "Support"
  },

  // ULM Computer Science Club Posts
  {
    title: "Hackathon this weekend!",
    description: "Join us for a 24-hour hackathon this weekend! Great prizes and networking opportunities.",
    type: "Events",
    communityName: "ULM Computer Science Club",
    submessName: "Events"
  },
  {
    title: "Python Workshop Series",
    description: "Starting a Python workshop series next week. Beginners welcome!",
    type: "Events",
    communityName: "ULM Computer Science Club",
    submessName: "Events"
  },
  {
    title: "Looking for project collaborators",
    description: "Working on a web app project and looking for frontend developers. Anyone interested?",
    type: "Projects",
    communityName: "ULM Computer Science Club",
    submessName: "Projects"
  },

  // ULM Housing & Roommates Posts
  {
    title: "Roommate needed - 2BR apartment",
    description: "Looking for a roommate for a 2-bedroom apartment near campus. $450/month including utilities.",
    type: "Roommate Search",
    communityName: "ULM Housing & Roommates",
    submessName: "Roommate Search"
  },
  {
    title: "Apartment review: University Place",
    description: "Just moved out of University Place apartments. Here's my honest review...",
    type: "Apartments",
    communityName: "ULM Housing & Roommates",
    submessName: "Apartments"
  },
  {
    title: "Tips for first-time renters",
    description: "Sharing some tips I learned as a first-time renter. Hope this helps!",
    type: "Housing Tips",
    communityName: "ULM Housing & Roommates",
    submessName: "Housing Tips"
  }
];

export const addSampleData = async (userId: string, userEmail: string) => {
  try {
    console.log("Adding sample communities...");
    
    // Add communities
    const communityIds: string[] = [];
    for (const community of sampleCommunities) {
      const communityRef = await addDoc(collection(db, 'communities'), {
        ...community,
        creatorId: userId,
        creatorUsername: userEmail?.split('@')[0] || 'User',
        memberCount: 1,
        createdAt: serverTimestamp(),
        members: [userId]
      });
      communityIds.push(communityRef.id);
      
      // Add user to community
      await addDoc(collection(db, 'users', userId, 'communities'), {
        communityId: communityRef.id,
        communityName: community.name,
        role: 'admin',
        joinedAt: serverTimestamp()
      });
    }
    
    console.log("Adding sample posts...");
    
    // Add posts
    for (const post of samplePosts) {
      const community = sampleCommunities.find(c => c.name === post.communityName);
      if (community) {
        const communityId = communityIds[sampleCommunities.indexOf(community)];
        await addDoc(collection(db, 'posts'), {
          title: post.title,
          description: post.description,
          type: post.type,
          userId: userId,
          createdAt: serverTimestamp(),
          userEmail: userEmail,
          communityId: communityId,
          communityName: post.communityName,
          submessId: post.submessName,
          submessName: post.submessName
        });
      }
    }
    
    console.log("Sample data added successfully!");
    return true;
  } catch (error) {
    console.error("Error adding sample data:", error);
    return false;
  }
}; 