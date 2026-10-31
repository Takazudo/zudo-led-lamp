# Board L target skeleton build (STM32G031F8P6). Build only: there is no flash target.
# Toolchain: Ubuntu 24.04 package gcc-arm-none-eabi 15:13.2.rel1-2 (arm-none-eabi-gcc 13.2.1).
CROSS ?= arm-none-eabi-
CC := $(CROSS)gcc
SIZE := $(CROSS)size
TOOLCHAIN_VERSION := 13.2.1
BUILD := build
V72 := ../src

ARCH := -mcpu=cortex-m0plus -mthumb
CFLAGS := $(ARCH) -std=c11 -Os -g -Wall -Wextra -Werror -pedantic -ffreestanding \
          -ffunction-sections -fdata-sections
LDFLAGS := $(ARCH) -nostdlib -nostartfiles -T stm32g031f8_flash.ld -Wl,--gc-sections \
           -Wl,-Map=$(BUILD)/board-l-skeleton.map -Wl,--print-memory-usage
SRCS := startup_stm32g031.c main.c clock.c board_ctrl.c
OBJS := $(SRCS:%.c=$(BUILD)/%.o)

# Portable V72 units: compiled for the target to check they build. Not linked.
V72_SRCS := $(filter-out $(V72)/test_input_app.c,$(wildcard $(V72)/*.c))
V72_OBJS := $(V72_SRCS:$(V72)/%.c=$(BUILD)/v72/%.o)

HOST_TEST_SRCS := test_input_app.c input_composition.c acquisition_registers.c \
  acquisition_word_rules.c discontinuous_acquisition.c adc_completed_frame.c \
  completed_frame_bridge.c output_composition.c tim3_readiness.c tim3_profile.c \
  tim3_access.c tim3_access_map.c preload_lifecycle.c tim3_preload.c host_timer_output.c \
  ctrl_timer_map.c adc_channel_config.c sample_adapter.c input_conversion.c thermal_gain.c \
  board_binding.c adc_preparation.c lamp_app.c lamp_control.c noise_stage.c normalized_transfer.c

.PHONY: all toolchain-check v72-objects host-test verify-regs clean
all: toolchain-check $(BUILD)/board-l-skeleton.elf

toolchain-check:
	@v=$$($(CC) -dumpversion); if [ "$$v" != "$(TOOLCHAIN_VERSION)" ] && [ -z "$(ALLOW_TOOLCHAIN)" ]; then \
	  echo "arm-none-eabi-gcc $$v != pinned $(TOOLCHAIN_VERSION) (set ALLOW_TOOLCHAIN=1 to override)"; exit 1; fi

$(BUILD)/%.o: %.c | $(BUILD)
	$(CC) $(CFLAGS) -c $< -o $@

$(BUILD)/board-l-skeleton.elf: $(OBJS) stm32g031f8_flash.ld
	$(CC) $(LDFLAGS) $(OBJS) -lgcc -o $@
	$(SIZE) $@

v72-objects: toolchain-check $(V72_OBJS)
$(BUILD)/v72/%.o: $(V72)/%.c | $(BUILD)/v72
	$(CC) $(CFLAGS) -I$(V72) -c $< -o $@

# Re-run the V72 host test with the host compiler, as recorded in ../provenance.
host-test: | $(BUILD)
	cd $(V72) && cc -std=c11 -O0 -g -Wall -Wextra -Werror -pedantic -I . $(HOST_TEST_SRCS) -o $(CURDIR)/$(BUILD)/host-test
	$(BUILD)/host-test

# Cross-check stm32g031_regs.h against ST/ARM headers fetched outside the repo.
verify-regs:
	@test -n "$(ST_DEVICE_INC)" -a -n "$(ST_LL_INC)" -a -n "$(CMSIS_CORE_INC)" || \
	  { echo "set ST_DEVICE_INC, ST_LL_INC and CMSIS_CORE_INC (see SOURCES.md)"; exit 1; }
	$(CC) $(ARCH) -std=c11 -Werror -DSTM32G031xx -fsyntax-only -I$(ST_DEVICE_INC) -I$(ST_LL_INC) \
	  -I$(CMSIS_CORE_INC) verify/verify_regs.c
	@echo "PASS: stm32g031_regs.h matches the ST/ARM headers"

$(BUILD) $(BUILD)/v72:
	mkdir -p $@

clean:
	rm -rf ./$(BUILD)
