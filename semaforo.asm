# Semaforo inteligente com media movel (janela 5)
# Funcoes: mostrar_menu, ler_fluxo, atualizar_media_e_tempo, simular_ciclo_semaforo

.data
menu_str:             .asciiz "\n--- Menu ---\n1 - Executar proximo ciclo\n0 - Sair\nEscolha: "
prompt_fluxo:         .asciiz "Digite o numero de carros neste ciclo: "
msg_inicio_ciclo:     .asciiz "\n--- Iniciando ciclo ---\n"
msg_verde:            .asciiz "[VERDE]    "
msg_amarelo:          .asciiz "[AMARELO]  "
msg_vermelho:         .asciiz "[VERMELHO] "
msg_tempo:            .asciiz "Tempo restante: "
newline:              .asciiz "\n"

fluxos:               .space 20          # 5 inteiros (janela)
flux_index:           .word 0
num_amostras:         .word 0
tempo_verde_atual:    .word 3
const_limite_fluxo:   .word 5
const_verde_baixo:    .word 3
const_verde_alto:     .word 7
const_t_amarelo:      .word 2
const_t_vermelho:     .word 3

.text
.globl main

# ---------------------------------
# mostrar_menu -> v0 = escolha
mostrar_menu:
    addi $sp, $sp, -4
    sw   $ra, 0($sp)

    li   $v0, 4
    la   $a0, menu_str
    syscall                 # print menu

    li   $v0, 5
    syscall                 # read int
    # v0 holds option

    lw   $ra, 0($sp)
    addi $sp, $sp, 4
    jr   $ra

# ---------------------------------
# ler_fluxo -> v0 = numero de carros
ler_fluxo:
    addi $sp, $sp, -4
    sw   $ra, 0($sp)

    li   $v0, 4
    la   $a0, prompt_fluxo
    syscall

    li   $v0, 5
    syscall                 # v0 = input

    lw   $ra, 0($sp)
    addi $sp, $sp, 4
    jr   $ra

# ---------------------------------
# atualizar_media_e_tempo(a0 = fluxo atual)
atualizar_media_e_tempo:
    addi $sp, $sp, -20
    sw   $ra, 16($sp)
    sw   $s0, 12($sp)
    sw   $s1, 8($sp)
    sw   $s2, 4($sp)
    sw   $s3, 0($sp)

    move $s0, $a0              # fluxo atual
    lw   $s1, flux_index
    lw   $s2, num_amostras

    # grava fluxo no vetor circular
    sll  $t0, $s1, 2           # offset = idx*4
    la   $t1, fluxos
    add  $t1, $t1, $t0
    sw   $s0, 0($t1)

    # atualiza indice circular
    addi $s1, $s1, 1
    li   $t2, 5
    bne  $s1, $t2, no_wrap
    li   $s1, 0
no_wrap:
    sw   $s1, flux_index

    # atualiza num_amostras (max 5)
    li   $t3, 5
    blt  $s2, $t3, inc_samples
    j    keep_samples
inc_samples:
    addi $s2, $s2, 1
    sw   $s2, num_amostras
keep_samples:

    # soma e media
    move $s3, $zero            # soma
    move $t4, $zero            # i = 0
    la   $t5, fluxos
sum_loop:
    beq  $t4, $s2, end_sum
    lw   $t6, 0($t5)
    add  $s3, $s3, $t6
    addi $t5, $t5, 4
    addi $t4, $t4, 1
    j    sum_loop
end_sum:
    # media = soma / num_amostras
    div  $s3, $s2
    mflo $t7                    # media

    # decide tempo_verde_atual
    lw   $t8, const_limite_fluxo
    blt  $t7, $t8, fluxo_baixo
    lw   $t9, const_verde_alto
    sw   $t9, tempo_verde_atual
    j    end_decide
fluxo_baixo:
    lw   $t9, const_verde_baixo
    sw   $t9, tempo_verde_atual
end_decide:

    lw   $ra, 16($sp)
    lw   $s0, 12($sp)
    lw   $s1, 8($sp)
    lw   $s2, 4($sp)
    lw   $s3, 0($sp)
    addi $sp, $sp, 20
    jr   $ra

# ---------------------------------
# simular_ciclo_semaforo
simular_ciclo_semaforo:
    addi $sp, $sp, -8
    sw   $ra, 4($sp)
    sw   $s0, 0($sp)

    # inicio ciclo
    li   $v0, 4
    la   $a0, msg_inicio_ciclo
    syscall

    # VERDE
    lw   $s0, tempo_verde_atual
    la   $a1, msg_verde
    jal  contador_fase

    # AMARELO
    lw   $s0, const_t_amarelo
    la   $a1, msg_amarelo
    jal  contador_fase

    # VERMELHO
    lw   $s0, const_t_vermelho
    la   $a1, msg_vermelho
    jal  contador_fase

    lw   $ra, 4($sp)
    lw   $s0, 0($sp)
    addi $sp, $sp, 8
    jr   $ra

# ---------------------------------
# contador_fase(a1 = msg estado, s0 = tempo)
# imprime countdown simples
contador_fase:
    addi $sp, $sp, -4
    sw   $ra, 0($sp)

fase_loop:
    blez $s0, fase_done

    # imprime estado
    li   $v0, 4
    move $a0, $a1
    syscall

    # imprime "Tempo restante: "
    li   $v0, 4
    la   $a0, msg_tempo
    syscall

    # imprime valor
    li   $v0, 1
    move $a0, $s0
    syscall

    # newline
    li   $v0, 4
    la   $a0, newline
    syscall

    addi $s0, $s0, -1
    j    fase_loop
fase_done:
    lw   $ra, 0($sp)
    addi $sp, $sp, 4
    jr   $ra

# ---------------------------------
# main loop
main:
main_loop:
    jal  mostrar_menu
    move $t0, $v0
    beq  $t0, $zero, sair

    # opcao 1
    jal  ler_fluxo
    move $a0, $v0
    jal  atualizar_media_e_tempo
    jal  simular_ciclo_semaforo
    j    main_loop

sair:
    li   $v0, 10
    syscall
