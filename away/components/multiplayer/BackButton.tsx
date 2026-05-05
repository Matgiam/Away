import { useRouter } from "next/navigation";
import { DynamicLiquidGlass } from "@/components/DynamicLiquidglass";

export default function BackButton() {
	const router = useRouter();

	return (
		<button onClick={() => router.push("/")}>
			<div className="absolute top-5 left-5 cursor-pointer">
				<DynamicLiquidGlass width={87} height={51} radius={15} refractionLevel={0.8} specularOpacity={0.7} glassBgOpacity={0.001}>
					<img src="/icons/arrow.svg" alt="Icon 1" style={{ width: "35px", height: "35px", objectFit: "contain" }} />
				</DynamicLiquidGlass>
			</div>
		</button>
	);
}
