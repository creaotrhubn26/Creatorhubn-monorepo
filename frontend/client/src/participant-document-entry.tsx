import React from "react";
import ReactDOM from "react-dom/client";
import { CssBaseline } from "@mui/material";
import { Route } from "wouter";
import ParticipantDocumentPage from "./pages/participant-document";

const rootElement = document.getElementById("root");

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <>
      <CssBaseline />
      <Route
        path="/participant-document/:documentId"
        component={ParticipantDocumentPage}
      />
    </>,
  );
}
