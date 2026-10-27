<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('task_columns', function (Blueprint $table) {
            $table->string('id', 36)->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('title', 120);
            $table->double('position')->default(0);
            $table->boolean('is_done')->default(false);
            $table->timestamps();

            $table->index(['user_id', 'position']);
        });

        Schema::create('tasks', function (Blueprint $table) {
            $table->string('id', 36)->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('parent_id', 36)->nullable();
            $table->string('task_column_id', 36);
            $table->string('title', 255);
            $table->longText('description')->nullable();
            $table->string('priority', 10)->default('medium');
            $table->dateTime('start_at', 3)->nullable();
            $table->dateTime('deadline', 3)->nullable();
            $table->boolean('completed')->default(false);
            $table->double('position')->default(0);
            $table->string('color', 9)->nullable();
            $table->timestamps();

            $table->index(['user_id', 'task_column_id']);
            $table->index(['user_id', 'parent_id']);
            $table->foreign('parent_id')->references('id')->on('tasks')->cascadeOnDelete();
            $table->foreign('task_column_id')->references('id')->on('task_columns')->cascadeOnDelete();
        });

        Schema::create('task_time_entries', function (Blueprint $table) {
            $table->string('id', 36)->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('task_id', 36);
            $table->date('entry_date');
            $table->unsignedSmallInteger('minutes');
            $table->string('note', 500)->default('');
            $table->timestamps();

            $table->index(['user_id', 'entry_date']);
            $table->foreign('task_id')->references('id')->on('tasks')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('task_time_entries');
        Schema::dropIfExists('tasks');
        Schema::dropIfExists('task_columns');
    }
};
