"use client";

import { SilkBackground } from "@/components/effects/SilkBackground";
import { useRooms } from "@/hooks/useRooms";
import { useCreateRoom } from "@/hooks/useCreateRoom";
import { useJoinRoom } from "@/hooks/useJoinRoom";
import BackButton from "@/components/multiplayer/BackButton";
import RoomList from "@/components/multiplayer/RoomList";
import CreateRoomModal from "@/components/multiplayer/CreateRoomModal";
import JoinRoomModal from "@/components/multiplayer/JoinRoomModal";
import { useAudioEngineContext } from "@/components/providers/AudioEngineProvider";

export default function MultiplayerLobby() {
	const { filter, setFilter, filteredRooms } = useRooms();
	const createRoomProps = useCreateRoom();
	const joinRoomProps = useJoinRoom();
	const { settings } = useAudioEngineContext();
	const backgroundAnimated = settings.backgroundAnimated && !settings.reducedMotion;

	return (
		<div className="h-full w-full text-gray-200 overflow-hidden flex relative">
			<SilkBackground color={settings.backgroundColor} scale={0.8} noiseIntensity={1.3} speed={3} rotation={180} animated={backgroundAnimated} />
			<BackButton />
			<div className="absolute inset-0 z-10 flex flex-col mt-30">
				<RoomList
					filter={filter}
					setFilter={setFilter}
					filteredRooms={filteredRooms}
					setShowCreate={createRoomProps.setShowCreate}
					handleJoinRoom={joinRoomProps.handleJoinRoom}
				/>
			</div>

			{createRoomProps.creating && (
				<div className="absolute stage-full-bleed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
					<div className="flex flex-col items-center gap-6">
						<div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
						<p className="text-white/80 text-lg italic tracking-wide">Creating your room…</p>
					</div>
				</div>
			)}

			<CreateRoomModal {...createRoomProps} />
			<JoinRoomModal {...joinRoomProps} />
		</div>
	);
}
