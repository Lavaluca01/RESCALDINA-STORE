/* eslint-disable require-jsdoc, max-len */

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {initializeApp} = require("firebase-admin/app");
const {getAuth} = require("firebase-admin/auth");
const {
  getFirestore,
  FieldValue,
} = require("firebase-admin/firestore");

initializeApp();

const db = getFirestore();
const auth = getAuth();

async function requireManager(request) {
  if (!request.auth) {
    throw new HttpsError(
        "unauthenticated",
        "Accesso richiesto.",
    );
  }

  const managerDoc = await db
      .collection("users")
      .doc(request.auth.uid)
      .get();

  if (!managerDoc.exists) {
    throw new HttpsError(
        "permission-denied",
        "Profilo non autorizzato.",
    );
  }

  const manager = managerDoc.data();

  if (manager.role !== "manager" || manager.active !== true) {
    throw new HttpsError(
        "permission-denied",
        "Operazione consentita solo al Manager.",
    );
  }
}

function validatePin(pin) {
  return typeof pin === "string" && /^\d{6}$/.test(pin);
}

function validateDepartment(department) {
  return [
    "CS",
    "PC",
    "GE",
    "TLC",
    "MAG",
    "TV",
  ].includes(department);
}

exports.createEmployee = onCall(
    {
      region: "europe-west8",
    },
    async (request) => {
      await requireManager(request);

      const name = String(
          request.data.name || "",
      ).trim().toUpperCase();

      const department = String(
          request.data.department || "",
      ).trim().toUpperCase();

      const pin = String(
          request.data.pin || "",
      ).trim();

      if (!name) {
        throw new HttpsError(
            "invalid-argument",
            "Inserisci il nominativo.",
        );
      }

      if (!validateDepartment(department)) {
        throw new HttpsError(
            "invalid-argument",
            "Reparto non valido.",
        );
      }

      if (!validatePin(pin)) {
        throw new HttpsError(
            "invalid-argument",
            "Il PIN deve contenere esattamente 6 cifre.",
        );
      }

      const employeeCode =
        "EMP" +
        Date.now().toString().slice(-9) +
        Math.floor(Math.random() * 90 + 10);

      const email =
        `${employeeCode.toLowerCase()}@gestione.local`;

      let userRecord = null;

      try {
        userRecord = await auth.createUser({
          email,
          password: pin,
          displayName: name,
          disabled: false,
        });

        await db
            .collection("users")
            .doc(userRecord.uid)
            .set({
              name,
              department,
              role: "employee",
              active: true,
              employeeCode,
              mustChangePin: true,
              createdAt: FieldValue.serverTimestamp(),
              createdBy: request.auth.uid,
            });

        await db
            .collection("directory")
            .doc(employeeCode)
            .set({
              uid: userRecord.uid,
              name,
              department,
              active: true,
              employeeCode,
            });

        return {
          success: true,
          uid: userRecord.uid,
          employeeCode,
          name,
          department,
        };
      } catch (error) {
        console.error(error);

        if (userRecord && userRecord.uid) {
          await auth
              .deleteUser(userRecord.uid)
              .catch(() => {});
        }

        throw new HttpsError(
            "internal",
            "Impossibile creare il dipendente.",
        );
      }
    },
);

exports.resetEmployeePin = onCall(
    {
      region: "europe-west8",
    },
    async (request) => {
      await requireManager(request);

      const uid = String(
          request.data.uid || "",
      ).trim();

      const pin = String(
          request.data.pin || "",
      ).trim();

      if (!uid) {
        throw new HttpsError(
            "invalid-argument",
            "Dipendente non valido.",
        );
      }

      if (!validatePin(pin)) {
        throw new HttpsError(
            "invalid-argument",
            "Il PIN deve contenere esattamente 6 cifre.",
        );
      }

      const employeeRef = db
          .collection("users")
          .doc(uid);

      const employeeDoc = await employeeRef.get();

      if (
        !employeeDoc.exists ||
        employeeDoc.data().role !== "employee"
      ) {
        throw new HttpsError(
            "not-found",
            "Dipendente non trovato.",
        );
      }

      await auth.updateUser(uid, {
        password: pin,
        disabled: false,
      });

      await employeeRef.update({
        mustChangePin: true,
        pinResetAt: FieldValue.serverTimestamp(),
        pinResetBy: request.auth.uid,
      });

      return {
        success: true,
      };
    },
);

exports.setEmployeeActive = onCall(
    {
      region: "europe-west8",
    },
    async (request) => {
      await requireManager(request);

      const uid = String(
          request.data.uid || "",
      ).trim();

      const active = request.data.active;

      if (!uid || typeof active !== "boolean") {
        throw new HttpsError(
            "invalid-argument",
            "Dati non validi.",
        );
      }

      const employeeRef = db
          .collection("users")
          .doc(uid);

      const employeeDoc = await employeeRef.get();

      if (
        !employeeDoc.exists ||
        employeeDoc.data().role !== "employee"
      ) {
        throw new HttpsError(
            "not-found",
            "Dipendente non trovato.",
        );
      }

      const employee = employeeDoc.data();

      await auth.updateUser(uid, {
        disabled: !active,
      });

      await employeeRef.update({
        active,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: request.auth.uid,
      });

      if (employee.employeeCode) {
        await db
            .collection("directory")
            .doc(employee.employeeCode)
            .update({
              active,
            });
      }

      return {
        success: true,
      };
    },
);

// =====================================================
// NOTIFICHE PUSH - GESTIONE RICHIESTE PERSONALE
// =====================================================

const {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentDeleted,
} = require("firebase-functions/v2/firestore");

const {getMessaging} = require("firebase-admin/messaging");

async function sendPushToUser(userId, title, body) {
  if (!userId) return;

  const userDoc = await db.collection("users").doc(userId).get();
  if (!userDoc.exists) return;

  const user = userDoc.data();
  const tokens = Array.isArray(user.fcmTokens) ?
    [...new Set(user.fcmTokens.filter(Boolean))] :
    [];

  if (!tokens.length) return;

  await getMessaging().sendEachForMulticast({
    tokens,
    notification: {
      title,
      body,
    },
  });
}

async function sendPushToManagers(title, body) {
  console.log("INIZIO sendPushToManagers");
  const snap = await db
      .collection("users")
      .where("role", "==", "manager")
      .get();

  const tokens = [];

  snap.forEach((doc) => {
    const manager = doc.data();

    if (
      manager.active === true &&
      manager.notificationsEnabled === true &&
      Array.isArray(manager.fcmTokens)
    ) {
      tokens.push(...manager.fcmTokens.filter(Boolean));
    }
  });

  const uniqueTokens = [...new Set(tokens)];

  console.log("Manager tokens trovati:", uniqueTokens.length);

  if (!uniqueTokens.length) {
    console.log("Nessun token Manager disponibile");
    return;
  }

  const result = await getMessaging().sendEachForMulticast({
    tokens: uniqueTokens,
    notification: {
      title,
      body,
    },
  });

  console.log(
      "FCM Manager:",
      "successi=" + result.successCount,
      "errori=" + result.failureCount,
  );

  const invalidTokens = [];

  result.responses.forEach((response, index) => {
    if (!response.success) {
      console.error(
          "Token fallito " + index + ":",
        response.error ? response.error.message : "errore sconosciuto",
      );

      if (
        response.error &&
        (response.error.code ===
          "messaging/registration-token-not-registered" ||
         response.error.message === "NotRegistered")
      ) {
        invalidTokens.push(uniqueTokens[index]);
      }
    }
  });

  if (invalidTokens.length) {
    console.log("Token non validi da rimuovere:", invalidTokens.length);

    const batch = db.batch();

    snap.forEach((doc) => {
      const data = doc.data();
      if (!Array.isArray(data.fcmTokens)) return;

      const cleanedTokens = data.fcmTokens.filter(
          (token) => !invalidTokens.includes(token),
      );

      if (cleanedTokens.length !== data.fcmTokens.length) {
        batch.update(doc.ref, {fcmTokens: cleanedTokens});
      }
    });

    await batch.commit();
    console.log("Token non validi rimossi da Firestore");
  }
}

exports.notifyNewRequest = onDocumentCreated(
    {
      document: "requests/{requestId}",
      region: "europe-west8",
    },
    async (event) => {
      const request = event.data ? event.data.data() : null;
      if (!request) return;

      const body =
      `${request.employeeName || "Dipendente"} · ` +
      `${request.type || "Richiesta"} · ` +
      `${request.from || ""} - ${request.to || ""}`;

      await sendPushToManagers(
          "Nuova richiesta personale",
          body,
      );
    },
);

exports.notifyRequestUpdated = onDocumentUpdated(
    {
      document: "requests/{requestId}",
      region: "europe-west8",
    },
    async (event) => {
      const before = event.data ? event.data.before.data() : null;
      const after = event.data ? event.data.after.data() : null;

      if (!before || !after) return;

      if (before.status === after.status) return;

      if (after.status === "approved") {
        await sendPushToUser(
            after.userId,
            "Richiesta approvata",
            `${after.type || "La tua richiesta"} · ${after.from || ""} - ${after.to || ""}`,
        );
      }

      if (after.status === "rejected") {
        const reason = after.managerNote ?
        ` · ${after.managerNote}` :
        "";

        await sendPushToUser(
            after.userId,
            "Richiesta rifiutata",
            `${after.type || "La tua richiesta"} · ${after.from || ""} - ${after.to || ""}${reason}`,
        );
      }
      if (after.status === "change_requested") {
        const reason = after.changeRequestedReason ?
        ` Motivo: ${after.changeRequestedReason}` :
        "";

        await sendPushToManagers(
            "Richiesta modifica preferenza",
            `${after.employeeName || "Un dipendente"} chiede di modificare ${after.type || "una richiesta"}: ${after.from || ""} → ${after.to || ""}.${reason}`,
        );
      }

      if (after.status === "unlocked") {
        await sendPushToUser(
            after.userId,
            "Modifica autorizzata",
            `Il Manager ha autorizzato la modifica di ${after.type || "una tua richiesta"}. Ora puoi cambiare le date.`,
        );
      }

      if (after.status === "pending" && before.status === "unlocked") {
        await sendPushToManagers(
            "Richiesta modificata",
            `${after.employeeName || "Un dipendente"} ha modificato ${after.type || "una richiesta"}: ${after.from || ""} → ${after.to || ""}. È nuovamente IN ATTESA di approvazione.`,
        );
      }
    },
);

exports.notifyRequestDeleted = onDocumentDeleted(
    {
      document: "requests/{requestId}",
      region: "europe-west8",
    },
    async (event) => {
      const request = event.data ? event.data.data() : null;
      if (!request) return;

      await sendPushToUser(
          request.userId,
          "Richiesta eliminata",
          `${request.type || "La tua richiesta"} · ${request.from || ""} - ${request.to || ""}. Puoi inserirla nuovamente se necessario.`,
      );
    },
);

