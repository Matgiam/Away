import { notFound } from "next/navigation";
import { getCourseById } from "@/lib/courses/catalog";
import CoursePlayerClient from "./CoursePlayerClient";

export const dynamic = "force-dynamic";

interface PageProps {
	params: Promise<{ courseId: string }>;
}

export default async function CoursePlayPage({ params }: PageProps) {
	const { courseId } = await params;
	const decoded = decodeURIComponent(courseId);
	const course = getCourseById(decoded);
	if (!course) notFound();
	return <CoursePlayerClient course={course} />;
}
