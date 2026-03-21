import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getOrCreateUser,
  getSessionUser,
  hashPassword,
  verifyPassword,
  createSession,
  deleteCurrentSession,
} from "@/lib/auth";
import { z } from "zod/v4";

// GET /api/account — Récupérer l'utilisateur courant (crée un anonyme si nécessaire)
export async function GET() {
  try {
    const user = await getOrCreateUser();

    return Response.json({
      id: user.id,
      username: user.username,
      pseudo: user.pseudo,
      isAnonymous: user.isAnonymous,
    });
  } catch (error) {
    console.error("Auth me error:", error);
    return Response.json(
      { error: "Erreur d'authentification" },
      { status: 500 }
    );
  }
}

const RegisterSchema = z.object({
  action: z.literal("register"),
  username: z
    .string()
    .min(3, "3 caractères minimum")
    .max(30, "30 caractères maximum")
    .regex(/^[a-zA-Z0-9_]+$/, "Lettres, chiffres et _ uniquement"),
  pseudo: z
    .string()
    .min(2, "2 caractères minimum")
    .max(50, "50 caractères maximum"),
  password: z.string().min(6, "6 caractères minimum"),
});

const LoginSchema = z.object({
  action: z.literal("login"),
  username: z.string().min(1, "Identifiant requis"),
  password: z.string().min(1, "Mot de passe requis"),
});

const LogoutSchema = z.object({
  action: z.literal("logout"),
});

const ActionSchema = z.discriminatedUnion("action", [
  RegisterSchema,
  LoginSchema,
  LogoutSchema,
]);

// POST /api/account — Login, Register, Logout
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = ActionSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Données invalides", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;

    switch (data.action) {
      case "register":
        return handleRegister(data);
      case "login":
        return handleLogin(data);
      case "logout":
        return handleLogout();
    }
  } catch (error) {
    console.error("Account error:", error);
    return Response.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

async function handleRegister(data: z.infer<typeof RegisterSchema>) {
  const { username, pseudo, password } = data;

  // Vérifier que le username n'est pas déjà pris
  const existing = await prisma.user.findUnique({
    where: { username },
  });
  if (existing) {
    return Response.json(
      { error: "Cet identifiant est déjà pris" },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(password);
  const currentUser = await getOrCreateUser();

  if (currentUser.isAnonymous) {
    // Upgrader l'utilisateur anonyme en compte
    const user = await prisma.user.update({
      where: { id: currentUser.id },
      data: {
        username,
        pseudo,
        passwordHash,
        isAnonymous: false,
      },
    });

    return Response.json({
      id: user.id,
      username: user.username,
      pseudo: user.pseudo,
      isAnonymous: false,
    });
  }

  return Response.json(
    { error: "Vous avez déjà un compte" },
    { status: 400 }
  );
}

async function handleLogin(data: z.infer<typeof LoginSchema>) {
  const { username, password } = data;

  const user = await prisma.user.findUnique({
    where: { username },
  });

  if (!user || !user.passwordHash) {
    return Response.json(
      { error: "Identifiant ou mot de passe incorrect" },
      { status: 401 }
    );
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return Response.json(
      { error: "Identifiant ou mot de passe incorrect" },
      { status: 401 }
    );
  }

  // Transférer les fichiers de l'utilisateur anonyme courant
  const currentUser = await getSessionUser();
  if (currentUser && currentUser.isAnonymous && currentUser.id !== user.id) {
    await prisma.file.updateMany({
      where: { userId: currentUser.id },
      data: { userId: user.id },
    });
    await prisma.user.delete({ where: { id: currentUser.id } });
  } else {
    await deleteCurrentSession();
  }

  await createSession(user.id);

  await prisma.user.update({
    where: { id: user.id },
    data: { lastSeenAt: new Date() },
  });

  return Response.json({
    id: user.id,
    username: user.username,
    pseudo: user.pseudo,
    isAnonymous: false,
  });
}

async function handleLogout() {
  await deleteCurrentSession();
  return Response.json({ success: true });
}
