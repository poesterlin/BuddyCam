export enum EventType {
	FRIEND_REQUEST = 'FRIEND_REQUEST',
	FRIEND_REQUEST_ACCEPTED = 'FRIEND_REQUEST_ACCEPTED',
	LOGIN = 'LOGIN',
	REGISTER = 'REGISTER',
	READY = 'READY',
	START = 'START',
	CAPTURE = 'CAPTURE',
	UPLOAD = 'UPLOAD',
	DELETE_MATCHUP = 'DELETE_MATCHUP',
	SUBSCRIPTION = 'SUBSCRIPTION',
	WEBRTC = 'WEBRTC'
}

export interface FriendRequestData {
	fromUsername: string;
	fromId: string;
}

export type FriendRequestAcceptedData = FriendRequestData;
export interface ReadyRequestData extends FriendRequestData {
	matchId: string;
}

export interface StartData {
	matchId: string;
}

export interface CaptureData extends StartData {
	timestamp: number;
}

export type UploadData = StartData;
export interface DeleteMatchupData extends StartData {
	fromUsername: string;
}

export interface WebRtcData {
	matchId: string;
	payload: RTCSessionDescriptionInit | RTCIceCandidateInit | RTCPeerConnectionIceEvent;
}
