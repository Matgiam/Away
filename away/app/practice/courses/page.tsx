import { getAllCourses } from "@/lib/courses/catalog";
import CoursesMenuClient from "./CoursesMenuClient";

export const dynamic = "force-dynamic";

export default function CoursesPage() {
	const courses = getAllCourses();
	return <CoursesMenuClient courses={courses} />;
}
