---
name: component-stusb4500qtr
description: Audit the exact STUSB4500QTR USB-PD sink controller, PESD24VS1UB,115 CC protectors, and 0603WAF5101T5E external Rd option. Use for Board P power, USB-C, NVM, pin, reset, protection, DNP, bring-up, or substitution work.
---

# STUSB4500QTR bundle

Run the central offline validator, then read all seven local JSON artifacts. Resolve the controller and both DNP subordinates independently. Cite source and fact IDs with their conditions and locators.

The retained ST controller documents are currently `SOURCE UNAVAILABLE`; controller identity, pin/state, operating-range, register, and NVM claims are therefore `UNSOURCED`. Do not treat the procedural gates below as confirmed numeric requirements until the exact official documents are byte-locked and re-reviewed. The UNI-ROYAL external-Rd family specification and Nexperia protector specification are independently available, but they do not close controller behavior.

For controller work, separate unpowered/dead-battery, reset, configuration-load, normal attached, explicit-contract, fault/recovery, and disconnect states. Treat open-drain `0` as asserted and Hi-Z as deasserted. Do not infer the programmed NVM image: require a normalized 40-byte artifact, byte-for-byte readback, reset reload, full power-cycle reload, and negotiated-output bench evidence. Record the as-received factory image before any write. Check the current ST endurance limit before authorizing repeated writes; the retained record deliberately leaves endurance open.

Provision only with a current-limited source that satisfies the documented VDD or VSYS operating range and with a common-ground I2C programmer using the board pogo interface. Keep the load disconnected for first power and verify VBUS, gate polarity, discharge timing, CC state, and fault registers in stages. Volatile register edits are not persistent NVM proof.

Apply the netlist assertions in `interactions.json` exactly. A deterministic wrong pin, missing series discharge resistor, wrong PMOS polarity, or unsafe voltage is a blocker; state-dependent negotiation, timing, thermal behavior, ESD performance, and as-built NVM contents require bench evidence.
