import { execAsync } from "ags/process"

export async function getCpu(): Promise<number> {
  try {
    const out = await execAsync(["bash", "-c", "top -bn1 | grep 'Cpu(s)' | awk '{print $2}'"])
    return Math.round(parseFloat(out) || 0)
  } catch {
    return 0
  }
}

export async function getMem(): Promise<number> {
  try {
    const out = await execAsync(["bash", "-c", "free | grep Mem | awk '{printf \"%.0f\", ($3/$2)*100}'"])
    return parseInt(out) || 0
  } catch {
    return 0
  }
}

export async function getGpu(): Promise<number> {
  try {
    const out = await execAsync(["bash", "-c", "nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits"])
    return parseInt(out.trim()) || 0
  } catch {
    return 0
  }
}