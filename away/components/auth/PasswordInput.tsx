// ============================================================================
// auth/PasswordInput.tsx
// ----------------------------------------------------------------------------
// Shared password input with a click-to-reveal eye button. Used by every
// auth form so the visibility toggle is consistent everywhere. Each instance
// has its own visibility state (sign-up has two — password + repeat — and
// they toggle independently).
// ============================================================================

"use client";

import { useState } from "react";

interface PasswordInputProps {
	id: string;
	value: string;
	onChange: (value: string) => void;
	required?: boolean;
	autoComplete?: string;
	placeholder?: string;
}

// Password field with a click-to-reveal eye button. Matches the existing
// dark-glass form styling and behaves like the surrounding text inputs —
// drop-in replacement for the raw <input type="password"> the auth forms
// previously used. The visibility state is local to each field so two
// password fields on the same form (sign-up: password + repeat-password)
// toggle independently.
export function PasswordInput({
	id,
	value,
	onChange,
	required,
	autoComplete,
	placeholder,
}: PasswordInputProps) {
	const [visible, setVisible] = useState(false);

	return (
		<div className="relative">
			<input
				id={id}
				type={visible ? "text" : "password"}
				required={required}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				autoComplete={autoComplete}
				placeholder={placeholder}
				className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-12 text-white italic outline-none focus:border-white/25 transition-colors placeholder:text-white/20 w-full"
			/>
			<button
				type="button"
				onClick={() => setVisible((v) => !v)}
				aria-label={visible ? "Hide password" : "Show password"}
				aria-pressed={visible}
				className="absolute inset-y-0 right-0 px-3 flex items-center text-black hover:text-black/70 transition-colors"
				// Prevent the click from submitting the form when the button is
				// inside a <form>.
				tabIndex={-1}
			>
				{visible ? <EyeOffIcon /> : <EyeIcon />}
			</button>
		</div>
	);
}

function EyeIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
			strokeLinejoin="round"
			className="w-5 h-5"
			aria-hidden
		>
			<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
			<circle cx="12" cy="12" r="3" />
		</svg>
	);
}

function EyeOffIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
			strokeLinejoin="round"
			className="w-5 h-5"
			aria-hidden
		>
			<path d="M17.94 17.94A10.06 10.06 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
			<line x1="1" y1="1" x2="23" y2="23" />
		</svg>
	);
}
