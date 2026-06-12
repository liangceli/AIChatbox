import { BadRequestException, Injectable } from "@nestjs/common";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export interface SafeUrlAddress {
  address: string;
  family: 4 | 6;
}

export interface SafeUrlResolution {
  url: URL;
  addresses: SafeUrlAddress[];
}

type HostnameResolver = (hostname: string) => Promise<SafeUrlAddress[]>;

const BLOCKED_HOSTNAMES = new Set([
  "instance-data",
  "instance-data.ec2.internal",
  "metadata",
  "metadata.google",
  "metadata.google.internal",
  "metadata.azure.internal"
]);

const BLOCKED_HOSTNAME_SUFFIXES = [
  ".home",
  ".internal",
  ".invalid",
  ".lan",
  ".local",
  ".localdomain",
  ".localhost"
];

@Injectable()
export class KnowledgeUrlSafetyService {
  private resolver: HostnameResolver = async (hostname) => {
    const addresses = await lookup(hostname, {
      all: true,
      verbatim: true
    });

    return addresses.map((address) => {
      if (address.family !== 4 && address.family !== 6) {
        throw new Error("Unsupported DNS address family.");
      }

      return {
        address: address.address,
        family: address.family
      };
    });
  };

  static createForTest(resolver: HostnameResolver): KnowledgeUrlSafetyService {
    const service = new KnowledgeUrlSafetyService();
    service.resolver = resolver;

    return service;
  }

  async resolveSafePublicUrl(input: string | URL): Promise<SafeUrlResolution> {
    const url = this.parseUrl(input);
    const hostname = normalizeHostname(url.hostname);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new BadRequestException("URL import only supports public HTTP(S) URLs.");
    }

    if (url.username || url.password) {
      throw new BadRequestException("URL import does not allow embedded credentials.");
    }

    if (this.isBlockedHostname(hostname)) {
      throw new BadRequestException("URL import target must be a public network address.");
    }

    const literalVersion = isIP(hostname);
    let addresses: SafeUrlAddress[];

    if (literalVersion === 4 || literalVersion === 6) {
      addresses = [
        {
          address: hostname,
          family: literalVersion
        }
      ];
    } else {
      try {
        addresses = await this.resolver(hostname);
      } catch {
        throw new BadRequestException("URL import target could not be resolved safely.");
      }
    }

    if (addresses.length === 0 || addresses.some((entry) => !isPublicNetworkAddress(entry.address))) {
      throw new BadRequestException("URL import target must resolve only to public network addresses.");
    }

    return {
      url,
      addresses
    };
  }

  private parseUrl(input: string | URL): URL {
    try {
      return input instanceof URL ? new URL(input.toString()) : new URL(input);
    } catch {
      throw new BadRequestException("URL import requires a valid public HTTP(S) URL.");
    }
  }

  private isBlockedHostname(hostname: string): boolean {
    return (
      !hostname ||
      BLOCKED_HOSTNAMES.has(hostname) ||
      BLOCKED_HOSTNAME_SUFFIXES.some(
        (suffix) => hostname === suffix.slice(1) || hostname.endsWith(suffix)
      )
    );
  }
}

export function isPublicNetworkAddress(input: string): boolean {
  const address = normalizeHostname(input.split("%")[0] ?? input);
  const version = isIP(address);

  if (version === 4) {
    return isPublicIpv4(address);
  }

  if (version === 6) {
    return isPublicIpv6(address);
  }

  return false;
}

function isPublicIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);

  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false;
  }

  const [first = 0, second = 0, third = 0, fourth = 0] = octets;

  if (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    first >= 224 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 192 && second === 0 && third === 0) ||
    (first === 192 && second === 0 && third === 2) ||
    (first === 192 && second === 88 && third === 99) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51 && third === 100) ||
    (first === 203 && second === 0 && third === 113)
  ) {
    return false;
  }

  // Azure platform virtual IP exposes host services and must not be importable.
  if (first === 168 && second === 63 && third === 129 && fourth === 16) {
    return false;
  }

  return true;
}

function isPublicIpv6(address: string): boolean {
  const bytes = parseIpv6(address);

  if (!bytes) {
    return false;
  }

  const mappedIpv4 = readMappedIpv4(bytes);

  if (mappedIpv4) {
    return isPublicIpv4(mappedIpv4);
  }

  // Public IPv6 unicast is within 2000::/3. Reject special/documentation/transition ranges.
  if ((bytes[0]! & 0xe0) !== 0x20) {
    return false;
  }

  return !(
    matchesIpv6Prefix(bytes, [0x20, 0x01, 0x00], 23) ||
    matchesIpv6Prefix(bytes, [0x20, 0x01, 0x0d, 0xb8], 32) ||
    matchesIpv6Prefix(bytes, [0x20, 0x02], 16) ||
    matchesIpv6Prefix(bytes, [0x3f, 0xff], 20)
  );
}

function parseIpv6(address: string): number[] | null {
  const normalized = address.toLowerCase();
  const halves = normalized.split("::");

  if (halves.length > 2) {
    return null;
  }

  const head = halves[0] ? halves[0].split(":").filter(Boolean) : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":").filter(Boolean) : [];
  const missing = 8 - head.length - tail.length;

  if (missing < 0 || (halves.length === 1 && missing !== 0)) {
    return null;
  }

  const parts = [...head, ...Array.from({ length: missing }, () => "0"), ...tail];

  if (parts.length !== 8 || parts.some((part) => !/^[0-9a-f]{1,4}$/.test(part))) {
    return null;
  }

  return parts.flatMap((part) => {
    const value = Number.parseInt(part, 16);
    return [(value >> 8) & 0xff, value & 0xff];
  });
}

function readMappedIpv4(bytes: number[]): string | null {
  const isMapped =
    bytes.slice(0, 10).every((byte) => byte === 0) && bytes[10] === 0xff && bytes[11] === 0xff;
  const isCompatible = bytes.slice(0, 12).every((byte) => byte === 0);

  if (!isMapped && !isCompatible) {
    return null;
  }

  return bytes.slice(12, 16).join(".");
}

function matchesIpv6Prefix(address: number[], prefix: number[], bits: number): boolean {
  const wholeBytes = Math.floor(bits / 8);
  const remainingBits = bits % 8;

  for (let index = 0; index < wholeBytes; index += 1) {
    if (address[index] !== prefix[index]) {
      return false;
    }
  }

  if (remainingBits === 0) {
    return true;
  }

  const mask = 0xff << (8 - remainingBits);
  return ((address[wholeBytes] ?? 0) & mask) === ((prefix[wholeBytes] ?? 0) & mask);
}

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
}
