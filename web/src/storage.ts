export type StoredMessage = {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  timestamp: number;
};

const databaseName = 'gamechat';
const storeName = 'messages';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveMessage(message: StoredMessage): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction(storeName, 'readwrite').objectStore(storeName).put(message);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  database.close();
}

export async function loadMessages(roomId: string): Promise<StoredMessage[]> {
  const database = await openDatabase();
  const messages = await new Promise<StoredMessage[]>((resolve, reject) => {
    const request = database.transaction(storeName, 'readonly').objectStore(storeName).getAll();
    request.onsuccess = () => resolve((request.result as StoredMessage[]).filter(message => message.room_id === roomId).sort((a, b) => a.timestamp - b.timestamp));
    request.onerror = () => reject(request.error);
  });
  database.close();
  return messages;
}
