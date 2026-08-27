import webpush from "web-push";
const keys = webpush.generateVAPIDKeys();
console.log("Copy these values to Vercel Environment Variables:\n");
console.log(`VITE_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log("VAPID_SUBJECT=mailto:your-email@example.com");
