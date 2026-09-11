<?php

use Illuminate\Support\Facades\Route;

// O frontend deste MVP e HTML/CSS/JavaScript puro e fica em public/app.
// Esta rota existe apenas para tornar http://localhost:8000 mais amigavel.
Route::get('/', function () {
    return redirect('/app/index.html');
});

Route::get('/painel', function () {
    return redirect('/app/index.html');
});
