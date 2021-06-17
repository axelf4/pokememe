#!/usr/bin/env luajit
-- See: https://vgmrips.net/wiki/VGM_Specification

local argparse = require "argparse"
local binaryheap = require "binaryheap"
local bit = require "bit"
local bor, band, rshift = bit.bor, bit.band, bit.rshift

function map(f, array)
   local res = {}
   for i, v in ipairs(array) do
	  res[i] = f(v)
   end
   return res
end

function leu16(u)
   return band(u, 0xFF), rshift(band(u, 0xFF00), 8)
end

function leu32(u)
   return band(u, 0xFF), band(rshift(u, 8), 0xFF),
	  band(rshift(u, 16), 0xFF), band(rshift(u, 24), 0xFF)
end

local cpuRate, samplingRate = 4194304, 44100
local s60th = 735 -- Number of samples in 60th of a second
local s50th = 882 -- Number of samples in 50th of a second

local args
do
   local parser = argparse("gbs2vgm", "Converts GBS files to VGM.")
   parser:argument("input", "Input GBS file.")
   args = parser:parse()
end

local out = assert(io.open("out.vgm", "wb"))
-- Write header
local header = {
   string.byte("V"), string.byte("g"), string.byte("m"), string.byte(" "),
   0, 0, 0, 0, -- EOF offset (gets written afterward)
   0x71, 0x01, 0x00, 0x00, -- Version number
   0, 0, 0, 0,
   0, 0, 0, 0, 0, 0, 0, 0,
   0, 0, 0, 0, -- Total NR samples (gets written afterward)
   0, 0, 0, 0, -- Loop offset
   0, 0, 0, 0, -- Loop #samples
   0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
   0, 0, 0, 0,
   0x84 - 0x34, 0, 0, 0, -- VGM data offset
   0, 0, 0, 0, 0, 0, 0, 0,
   0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
   0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
   0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
   0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
   leu32(4194304) -- GB DMG clock
}
out:write(table.concat(map(string.char, header)))

--- Returns string of commands for waiting `i` samples.
local function waitCommands(i)
   if i == 0 then return "" end

   print("calculating wait for i = ", i)

   -- Use uniform-cost search
   local function lt(a, b) return #(a[2]) < #(b[2]) end
   local frontier = binaryheap.minHeap(lt)
   frontier:insert({i, ""})
   while true do
	  local rem, partialCmd = unpack(frontier:pop())
	  if rem == 0 then return partialCmd end

	  -- APU does not support 0x63
	  if false and s50th <= rem then
		 frontier:insert({ rem - s50th, partialCmd .. string.char(0x63) })
	  end
	  if s60th <= rem then
		 frontier:insert({ rem - s60th, partialCmd .. string.char(0x62) })
	  end
	  do
		 local n = math.min(16, rem) - 1
		 frontier:insert({ rem - (n + 1), partialCmd .. string.char(bor(0x70, n)) })
	  end
	  do
		 local n = math.min(0xFFFF, rem)
		 frontier:insert({ rem - n, partialCmd .. string.char(0x61, leu16(n)) })
	  end
   end
end

local cmds = waitCommands(737)
for i = 1, #cmds do print(string.format("0x%x", string.byte(cmds:sub(i, i)))) end

if true then

local f = io.popen("gbsplay -o iodumper " .. args.input .. " 1 1")
local sampleCount = 0
for line in f:lines() do
   local offset, reg, val = string.match(line, "(%x%x%x%x%x%x%x%x) ff(%x%x)=(%x%x)")
   if not offset then goto continue end
   samples = math.floor(tonumber(offset, 16) / (cpuRate / samplingRate)) -- Convert cycles to samples
   reg, val = tonumber(reg, 16), tonumber(val, 16)

   sampleCount = sampleCount + samples
   out:write(waitCommands(samples))

   if 0x10 <= reg and reg <= 0x3F then
	  -- Note: Register 00 equals GameBoy address FF10
	  out:write(string.char(0xB3, reg - 0x10, val))
   end

   ::continue::
end
f:close()

out:write(string.char(0x66)) -- End of sound data

-- Write EOF offset
local len = out:seek()
out:seek("set", 0x04)
out:write(string.char(leu32(len - 0x04)))
-- Write total NR of samples
out:seek("set", 0x18)
out:write(string.char(leu32(sampleCount)))
out:close()

end
