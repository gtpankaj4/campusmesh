export function generateChatId(userId1: string, userId2: string): string {
  // Sort the user IDs alphabetically to ensure consistent chat ID
  const sortedIds = [userId1, userId2].sort();
  return `${sortedIds[0]}_${sortedIds[1]}`;
}

export function isValidChatId(chatId: string, currentUserId: string): boolean {
  // Check if the current user is part of this chat
  return chatId.includes(currentUserId);
} 