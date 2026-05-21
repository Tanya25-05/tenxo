import '../styles/globals.css';
import { useRouter } from 'next/router';

function TenxoApp({ Component, pageProps }) {
  const router = useRouter();
  // Simple check: don't show sidebar on landing page
  const isApp = router.pathname.startsWith('/app');

  return (
    <div className="min-h-screen bg-[#09090b] text-gray-100 font-sans">
      <Component {...pageProps} />
    </div>
  );
}

export default TenxoApp;