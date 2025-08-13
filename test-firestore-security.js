// Test script to verify Firestore security rules
// Run this in browser console to test if rules are working

async function testFirestoreRules() {
  console.log('🧪 Testing Firestore Security Rules...');
  
  try {
    // Try to fetch all posts
    const postsRef = firebase.firestore().collection('posts');
    const snapshot = await postsRef.get();
    
    console.log(`📊 Total posts fetched: ${snapshot.size}`);
    
    const posts = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      posts.push({
        id: doc.id,
        title: data.title,
        communityId: data.communityId || 'GENERAL',
        communityName: data.communityName || 'General'
      });
    });
    
    console.log('📝 Posts received:', posts);
    
    // Check if any private community posts are visible
    const communityPosts = posts.filter(p => p.communityId !== 'GENERAL');
    console.log(`🏢 Community posts visible: ${communityPosts.length}`);
    
    if (communityPosts.length > 0) {
      console.log('⚠️ Community posts are visible - check if user is member of these communities');
      console.log('🔍 Community posts:', communityPosts);
    } else {
      console.log('✅ Only general posts visible - rules working correctly for new users');
    }
    
  } catch (error) {
    console.error('❌ Error testing rules:', error);
  }
}

// Run the test
testFirestoreRules();