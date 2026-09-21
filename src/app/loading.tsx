export default function Loading() {
  return (
    <div className="proto-page">
      <section className="proto-phone" aria-busy="true" aria-label="拜访助手">
        <header className="proto-top">
          <h1>拜访助手</h1>
        </header>
        <div className="proto-scroll is-idle">
          <div className="proto-idle">
            <div className="proto-idle-hero">
              <h2 className="proto-hello">欢迎</h2>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
