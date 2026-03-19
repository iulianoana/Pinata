"use client";
import dynamic from "next/dynamic";

const ClientApp = dynamic(() => import("../../src/ClientApp"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#F0FAF8",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <img
          src="/icons/logo.png"
          alt="Piñata"
          style={{ width: 100, height: 100, marginBottom: 12 }}
        />
        <p
          style={{
            color: "#5E8078",
            fontSize: 16,
            fontWeight: 600,
            fontFamily: "'Nunito', sans-serif",
          }}
        >
          Loading...
        </p>
      </div>
    </div>
  ),
});

export default function Page() {
  return <ClientApp />;
}
