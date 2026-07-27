export interface StoredCapture {
	matchId: string;
	attemptId: string;
	blob: Blob;
	peerRecorded: boolean;
	createdAt: number;
}

const DATABASE_NAME = 'buddycam-captures';
const STORE_NAME = 'captures';

function openDatabase(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DATABASE_NAME, 1);
		request.onupgradeneeded = () => {
			if (!request.result.objectStoreNames.contains(STORE_NAME)) {
				request.result.createObjectStore(STORE_NAME, { keyPath: 'matchId' });
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

async function transaction<T>(
	mode: IDBTransactionMode,
	run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
	const database = await openDatabase();
	return new Promise((resolve, reject) => {
		const tx = database.transaction(STORE_NAME, mode);
		const request = run(tx.objectStore(STORE_NAME));
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
		tx.oncomplete = () => database.close();
		tx.onerror = () => reject(tx.error);
	});
}

export function saveCapture(capture: StoredCapture) {
	return transaction('readwrite', (store) => store.put(capture));
}

export function getCapture(matchId: string) {
	return transaction<StoredCapture | undefined>('readonly', (store) => store.get(matchId));
}

export function deleteCapture(matchId: string) {
	return transaction('readwrite', (store) => store.delete(matchId));
}
