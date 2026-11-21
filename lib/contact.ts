// Where students send feedback, ideas and questions.
export const FEEDBACK_EMAIL = "pritam14chavhan@gmail.com";
export const feedbackHref = (subject = "KNOT feedback") => `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}`;
