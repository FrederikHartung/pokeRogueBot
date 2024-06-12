package com.sfh.pokeRogueBot.repository;

import com.sfh.pokeRogueBot.model.entities.RunPropertyEntity;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

//@Repository
//public interface RunPropertyEntityRepository extends JpaRepository<RunPropertyEntity, Integer>{
public interface RunPropertyEntityRepository{

    @Query("SELECT r FROM RunPropertyEntity r ORDER BY r.runNumber DESC")
    Optional<RunPropertyEntity> findFirstOrderByRunNumberDesc();


}
