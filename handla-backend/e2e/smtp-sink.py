#!/usr/bin/env python3
"""
Minimal SMTP capture server for E2E testing (NOT production code).

Listens on 127.0.0.1:2525, accepts any message, and appends the raw message
(headers + body) to e2e/captured/mailbox.log. The Handla OTP email carries the
plaintext code in its Subject line ("Your Handla verification code: NNNNNN"),
so the test harness can read the real code the app actually sent — proving the
full email path executed, without needing an external SMTP provider.

Pure stdlib (socket) because Python 3.12+ removed the `smtpd` module.
"""
import socket
import threading
import os
import datetime

HOST = "127.0.0.1"
PORT = int(os.environ.get("SINK_PORT", "2525"))
OUT = os.path.join(os.path.dirname(__file__), "captured", "mailbox.log")


def handle(conn: socket.socket, addr):
    def send(line: str):
        conn.sendall((line + "\r\n").encode())

    try:
        send("220 handla-e2e-sink ESMTP")
        buf = b""
        in_data = False
        data_lines = []
        while True:
            chunk = conn.recv(4096)
            if not chunk:
                break
            buf += chunk
            while b"\r\n" in buf:
                line, buf = buf.split(b"\r\n", 1)
                text = line.decode(errors="replace")

                if in_data:
                    if text == ".":
                        in_data = False
                        raw = "\n".join(data_lines)
                        with open(OUT, "a", encoding="utf-8") as f:
                            f.write("\n===== MESSAGE @ %s =====\n" % datetime.datetime.utcnow().isoformat())
                            f.write(raw + "\n")
                        data_lines = []
                        send("250 OK: queued")
                    else:
                        data_lines.append(text[1:] if text.startswith("..") else text)
                    continue

                upper = text.upper()
                if upper.startswith("EHLO") or upper.startswith("HELO"):
                    send("250-handla-e2e-sink")
                    send("250 AUTH LOGIN PLAIN")
                elif upper.startswith("AUTH"):
                    send("235 2.7.0 Authentication successful")
                elif upper.startswith("MAIL FROM"):
                    send("250 OK")
                elif upper.startswith("RCPT TO"):
                    send("250 OK")
                elif upper == "DATA":
                    in_data = True
                    send("354 End data with <CR><LF>.<CR><LF>")
                elif upper.startswith("QUIT"):
                    send("221 Bye")
                    conn.close()
                    return
                elif upper.startswith("RSET"):
                    send("250 OK")
                elif upper.startswith("NOOP"):
                    send("250 OK")
                else:
                    send("250 OK")
    except Exception as e:
        try:
            conn.close()
        except Exception:
            pass


def main():
    open(OUT, "w").close()  # truncate on start
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind((HOST, PORT))
    s.listen(50)
    print("SMTP sink listening on %s:%d -> %s" % (HOST, PORT, OUT), flush=True)
    while True:
        conn, addr = s.accept()
        threading.Thread(target=handle, args=(conn, addr), daemon=True).start()


if __name__ == "__main__":
    main()
