import "../styles/globals.css";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

function TenxoApp({ Component, pageProps }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#09090b] text-gray-100 font-sans">
      <Navbar />
      <main className="flex-1">
        <div className="marketing-main">
          <Component {...pageProps} />
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default TenxoApp;
