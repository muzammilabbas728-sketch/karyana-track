import sys
from app.licensing import generate_license_key


def main():
    if len(sys.argv) < 2:
        print("Usage: python generate_license.py <FINGERPRINT>")
        sys.exit(1)
    fingerprint = sys.argv[1].strip().upper()
    key = generate_license_key(fingerprint=fingerprint)
    print(f"Fingerprint: {fingerprint}")
    print(f"License Key: {key}")


if __name__ == "__main__":
    main()
