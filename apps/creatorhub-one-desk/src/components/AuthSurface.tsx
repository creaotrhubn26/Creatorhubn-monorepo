import { Box, Container } from "@mui/material";
import { ReactNode } from "react";
import { deskColors } from "../deskTheme";
import authBackground from "../assets/no-projects-bg-v2.png";

export default function AuthSurface({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: deskColors.bg,
        backgroundImage: `
          radial-gradient(circle at 50% 42%, rgba(15,23,41,0.16) 0%, rgba(10,15,26,0.48) 55%, rgba(10,15,26,0.78) 100%),
          url(${authBackground})
        `,
        backgroundPosition: "center",
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
      }}
    >
      <Container
        maxWidth="sm"
        sx={{
          minHeight: "100vh",
          py: { xs: 2, sm: 3 },
          display: "flex",
          alignItems: "center",
        }}
      >
        <Box
          sx={{
            width: "100%",
            p: { xs: 3, sm: 4 },
            borderRadius: 3,
            bgcolor: deskColors.panel,
            border: `1px solid ${deskColors.border}`,
            boxShadow: "0 28px 80px rgba(0,0,0,0.48)",
            backdropFilter: "blur(18px)",
          }}
        >
          {children}
        </Box>
      </Container>
    </Box>
  );
}
