# Firestore Rules Test Cases

## Private Community Posts Security

The updated Firestore rules should now properly filter posts based on community membership:

### Test Cases:

1. **General Posts (no communityId)**
   - ✅ Should be visible to all authenticated users
   - Rule: `!('communityId' in resource.data)`

2. **Public Community Posts**
   - ✅ Should be visible to all authenticated users
   - Rule: `get(/databases/$(database)/documents/communities/$(resource.data.communityId)).data.isPrivate == false`

3. **Private Community Posts**
   - ✅ Should only be visible to community members
   - Rule: `exists(/databases/$(database)/documents/users/$(request.auth.uid)/communities/$(resource.data.communityId))`

### New User Experience:

1. **New users with no communities**:
   - Will only see general posts and public community posts
   - Private community posts are automatically filtered by Firestore rules
   - Empty state shows welcome message with options to find meshes or create posts

2. **Existing users**:
   - See all posts they have access to based on their community memberships
   - Private posts from communities they're not members of are filtered out

### Security Benefits:

- Server-side filtering prevents any client-side bypassing
- No sensitive data is transmitted to unauthorized users
- Automatic enforcement without additional client-side logic
- Performance improvement by filtering at the database level