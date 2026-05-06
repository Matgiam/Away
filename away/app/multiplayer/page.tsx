"use client";

import { SilkBackground } from "@/components/effects/SilkBackground";
import { useRooms } from "@/hooks/useRooms";
import { useCreateRoom } from "@/hooks/useCreateRoom";
import { useJoinRoom } from "@/hooks/useJoinRoom";
import BackButton from "@/components/multiplayer/BackButton";
import RoomList from "@/components/multiplayer/RoomList";
import CreateRoomModal from "@/components/multiplayer/CreateRoomModal";
import JoinRoomModal from "@/components/multiplayer/JoinRoomModal";

export default function MultiplayerLobby() {
	const { filter, setFilter, filteredRooms } = useRooms();
	const createRoomProps = useCreateRoom();
	const joinRoomProps = useJoinRoom();

	return (
		<div className="h-screen w-screen bg-[#050505] text-gray-200 overflow-hidden flex relative">
			<SilkBackground color="#0b0416" scale={0.8} noiseIntensity={1.3} speed={3} rotation={180} />
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

			<CreateRoomModal {...createRoomProps} />
			<JoinRoomModal {...joinRoomProps} />
		</div>
	);
}
