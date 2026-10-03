import RingTryOn from "@/components/RingTryOn";

export default function Home() {
  return (
    <main className="page">
      <header className="site-header">
        <span className="brand">LUMIÈRE</span>
        <span className="header-label">VIRTUAL JEWELLERY STUDIO</span>
      </header>

      <section className="intro">
        <p className="eyebrow">YOUR RING, YOUR MOMENT</p>
        <h1>Find the one.</h1>
        <p>
          Explore how your favourite ring looks on your hand
          using our virtual try-on experience.
        </p>
      </section>

      <RingTryOn />

      <footer className="page-footer">
        <p>
          Your camera is used for the live try-on.
          This prototype does not upload your video to an app backend.
        </p>
      </footer>
    </main>
  );
}